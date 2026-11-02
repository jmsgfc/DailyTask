import { create } from "zustand";

import { deleteCheckin, upsertCheckin } from "../db/checkins";
import { getDb } from "../db/client";
import { checkinKey } from "../domain/keys";
import type { Checkin, CheckinStatus } from "../domain/types";
import { currentSource, emitCheckinsChanged } from "../shared/events";
import { enqueueWrite } from "../shared/queue";

export interface CheckinsState {
  byKey: Map<string, Checkin>;
  loaded: boolean;
  hydrate: (checkins: Checkin[]) => void;
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

  setStatus: (taskId, date, status) =>
    enqueueWrite(async () => {
      const db = await getDb();
      const next = new Map(get().byKey);

      if (status === null) {
        await deleteCheckin(db, taskId, date);
        next.delete(checkinKey(taskId, date));
      } else {
        const checkin = await upsertCheckin(db, { taskId, date, status });
        next.set(checkinKey(taskId, date), checkin);
      }

      set({ byKey: next, loaded: true });
      void emitCheckinsChanged({ date, source: currentSource() }).catch(
        () => undefined,
      );
    }),
}));

function toCheckinMapFromArray(checkins: Checkin[]): Map<string, Checkin> {
  const map = new Map<string, Checkin>();
  for (const checkin of checkins) {
    map.set(checkinKey(checkin.taskId, checkin.date), checkin);
  }
  return map;
}
