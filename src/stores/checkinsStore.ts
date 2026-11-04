import { create } from "zustand";

import {
  deleteCheckin,
  listCheckins,
  setCheckinNote,
  setCheckinValue,
  upsertCheckin,
} from "../db/checkins";
import { getDb } from "../db/client";
import { checkinKey } from "../domain/keys";
import type { Checkin, CheckinStatus } from "../domain/types";
import { currentSource, emitCheckinsChanged } from "../shared/events";
import { enqueueWrite } from "../shared/queue";

export interface CheckinsState {
  byKey: Map<string, Checkin>;
  loaded: boolean;
  hydrate: (checkins: Checkin[]) => void;
  /** 跨窗口收到失效信号后重查；只替换数据，不再回发事件。 */
  reload: () => Promise<void>;
  /** status = null 表示清空该格。 */
  setStatus: (
    taskId: string,
    date: string,
    status: CheckinStatus | null,
  ) => Promise<void>;
  /** 写入自由值；null / 空白表示清空。只记录不判定。 */
  setValue: (
    taskId: string,
    date: string,
    value: string | null,
  ) => Promise<void>;
  /** 给已有打卡写备注；没有打卡行时不建行。 */
  setNote: (
    taskId: string,
    date: string,
    note: string | null,
  ) => Promise<void>;
}

export const useCheckinsStore = create<CheckinsState>()((set, get) => ({
  byKey: new Map(),
  loaded: false,

  hydrate: (checkins) =>
    set({ byKey: toCheckinMapFromArray(checkins), loaded: true }),

  reload: async () => {
    const db = await getDb();
    const checkins = await listCheckins(db);
    set({ byKey: toCheckinMapFromArray(checkins), loaded: true });
  },

  setStatus: (taskId, date, status) => {
    const key = checkinKey(taskId, date);
    const previous = get().byKey;
    const optimistic = new Map(previous);

    if (status === null) {
      optimistic.delete(key);
    } else {
      optimistic.set(key, {
        id: previous.get(key)?.id ?? `pending-${key}`,
        taskId,
        date,
        status,
        value: previous.get(key)?.value ?? null,
        note: previous.get(key)?.note ?? null,
        updatedAt: new Date().toISOString(),
      });
    }
    set({ byKey: optimistic });

    return enqueueWrite(async () => {
      try {
        const db = await getDb();

        if (status === null) {
          await deleteCheckin(db, taskId, date);
        } else {
          const saved = await upsertCheckin(db, {
            taskId,
            date,
            status,
            note: previous.get(key)?.note ?? null,
          });
          set({ byKey: new Map(get().byKey).set(key, saved) });
        }

        set({ loaded: true });
        void emitCheckinsChanged({ date, source: currentSource() }).catch(
          () => undefined,
        );
      } catch (error) {
        console.error("[checkins] 写库失败，已回滚", error);
        // 只回滚这一格，避免把同时进行的其他写入一起撤掉。
        const rollback = new Map(get().byKey);
        const before = previous.get(key);
        if (before) {
          rollback.set(key, before);
        } else {
          rollback.delete(key);
        }
        set({ byKey: rollback });
        throw error;
      }
    });
  },

  setValue: (taskId, date, value) => {
    const key = checkinKey(taskId, date);
    const previous = get().byKey;
    const before = previous.get(key);
    const normalized = value?.trim() ? value.trim() : null;

    // 乐观更新：值只影响 value；清空 recorded 行时整行消失。
    const optimistic = new Map(previous);
    if (normalized === null) {
      if (before) {
        if (before.status === "recorded") {
          optimistic.delete(key);
        } else {
          optimistic.set(key, {
            ...before,
            value: null,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } else {
      optimistic.set(key, {
        id: before?.id ?? `pending-${key}`,
        taskId,
        date,
        status: before?.status ?? "recorded",
        value: normalized,
        note: before?.note ?? null,
        updatedAt: new Date().toISOString(),
      });
    }
    set({ byKey: optimistic });

    return enqueueWrite(async () => {
      try {
        const saved = await setCheckinValue(
          await getDb(),
          taskId,
          date,
          normalized,
        );
        const next = new Map(get().byKey);
        if (saved === null) {
          next.delete(key);
        } else {
          next.set(key, saved);
        }
        set({ byKey: next, loaded: true });
        void emitCheckinsChanged({ date, source: currentSource() }).catch(
          () => undefined,
        );
      } catch (error) {
        console.error("[checkins] 写值失败，已回滚", error);
        const rollback = new Map(get().byKey);
        if (before) {
          rollback.set(key, before);
        } else {
          rollback.delete(key);
        }
        set({ byKey: rollback });
        throw error;
      }
    });
  },

  setNote: (taskId, date, note) => {
    const key = checkinKey(taskId, date);
    const previous = get().byKey;
    const before = previous.get(key);
    if (!before) {
      return Promise.resolve();
    }

    const normalized = note?.trim() ? note.trim() : null;
    const optimistic = new Map(previous).set(key, {
      ...before,
      note: normalized,
      updatedAt: new Date().toISOString(),
    });
    set({ byKey: optimistic });

    return enqueueWrite(async () => {
      try {
        const saved = await setCheckinNote(
          await getDb(),
          taskId,
          date,
          normalized,
        );
        if (saved) {
          set({ byKey: new Map(get().byKey).set(key, saved), loaded: true });
        }
        void emitCheckinsChanged({ date, source: currentSource() }).catch(
          () => undefined,
        );
      } catch (error) {
        console.error("[checkins] 写备注失败，已回滚", error);
        const rollback = new Map(get().byKey);
        rollback.set(key, before);
        set({ byKey: rollback });
        throw error;
      }
    });
  },
}));

function toCheckinMapFromArray(checkins: Checkin[]): Map<string, Checkin> {
  const map = new Map<string, Checkin>();
  for (const checkin of checkins) {
    map.set(checkinKey(checkin.taskId, checkin.date), checkin);
  }
  return map;
}
