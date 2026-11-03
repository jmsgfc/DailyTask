import { create } from "zustand";

import { deleteCheckin, listCheckins, upsertCheckin } from "../db/checkins";
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
}

export const useCheckinsStore = create<CheckinsState>()((set, get) => ({
  byKey: new Map(),
  loaded: false,

  hydrate: (checkins) => set({ byKey: toCheckinMapFromArray(checkins) }),

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
}));

function toCheckinMapFromArray(checkins: Checkin[]): Map<string, Checkin> {
  const map = new Map<string, Checkin>();
  for (const checkin of checkins) {
    map.set(checkinKey(checkin.taskId, checkin.date), checkin);
  }
  return map;
}
