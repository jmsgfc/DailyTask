import { isApplicable } from "./applicability";
import { checkinKey } from "./keys";
import type {
  CellState,
  Checkin,
  CheckinStatus,
  Settings,
  Task,
} from "./types";

export type { CellState };

/**
 * 判定顺序（docs/architecture/domain.md）：
 * 1. 不在启用区间 → none
 * 2. 有打卡记录 → 直接返回记录状态
 * 3. 今天及以后 → pending
 * 4. 过去 + 自动结算 → missed（只投影，不写库）
 * 5. 其余 → pending
 */
export function projectCell(
  task: Task,
  date: string,
  checkin: Checkin | undefined,
  settings: Settings,
  today: string,
): CellState {
  if (!isApplicable(task.intervals, date)) {
    return "none";
  }
  if (checkin) {
    return checkin.status;
  }
  if (date >= today) {
    return "pending";
  }
  return settings.autoSettleMissed ? "missed" : "pending";
}

/** 单击循环：空 → done → missed → 空；skipped 只能通过「今天不做」进出。 */
export function nextCellState(state: CellState): CheckinStatus | null {
  if (state === "done") {
    return "missed";
  }
  if (state === "missed") {
    return null;
  }
  return "done";
}

export interface DayProgress {
  done: number;
  missed: number;
  skipped: number;
  pending: number;
  /** 分母：适用任务数扣除「今天不做」。 */
  applicable: number;
  ratio: number;
}

export function dayProgress(
  tasks: Task[],
  checkins: Map<string, Checkin>,
  date: string,
  settings: Settings,
  today: string,
): DayProgress {
  let done = 0;
  let missed = 0;
  let skipped = 0;
  let pending = 0;
  let applicable = 0;

  for (const task of tasks) {
    if (!isApplicable(task.intervals, date)) {
      continue;
    }
    applicable += 1;

    const state = projectCell(
      task,
      date,
      checkins.get(checkinKey(task.id, date)),
      settings,
      today,
    );
    switch (state) {
      case "done":
        done += 1;
        break;
      case "missed":
        missed += 1;
        break;
      case "skipped":
        skipped += 1;
        break;
      case "pending":
        pending += 1;
        break;
      case "none":
        applicable -= 1;
        break;
    }
  }

  const denominator = applicable - skipped;
  return {
    done,
    missed,
    skipped,
    pending,
    applicable,
    ratio: denominator === 0 ? 0 : done / denominator,
  };
}
