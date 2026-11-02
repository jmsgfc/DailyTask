import type { Interval, Task } from "./types";

/**
 * 任一区间命中即适用；日期是 YYYY-MM-DD，可直接按字符串比较。
 * end 为 null 表示至今有效。
 */
export function isApplicable(intervals: Interval[], date: string): boolean {
  return intervals.some(
    (interval) =>
      interval.start <= date && (interval.end === null || date <= interval.end),
  );
}

export function applicableTasks(tasks: Task[], date: string): Task[] {
  return tasks.filter((task) => isApplicable(task.intervals, date));
}
