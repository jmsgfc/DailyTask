import { diffDays } from "./date";
import { normalizeEveryDays } from "./intervals";
import type { Interval, Task } from "./types";

/**
 * 任一区间命中即适用；日期是 YYYY-MM-DD，可直接按字符串比较。
 * end 为 null 表示至今有效；everyDays 以区间启用日为第 1 天，
 * 每 N 天命中一次，1 表示每天。
 */
export function isApplicable(intervals: Interval[], date: string): boolean {
  return intervals.some((interval) => {
    if (interval.start > date) {
      return false;
    }
    if (interval.end !== null && date > interval.end) {
      return false;
    }
    const everyDays = normalizeEveryDays(interval.everyDays);
    return everyDays === 1 || diffDays(date, interval.start) % everyDays === 0;
  });
}

export function applicableTasks(tasks: Task[], date: string): Task[] {
  return tasks.filter((task) => isApplicable(task.intervals, date));
}
