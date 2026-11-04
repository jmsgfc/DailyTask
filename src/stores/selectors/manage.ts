import { useMemo } from "react";

import { logicalToday } from "../../domain/date";
import { isRetired } from "../../domain/grid";
import type { Task } from "../../domain/types";
import { useSettingsStore } from "../settingsStore";
import { useTasksStore } from "../tasksStore";

export type ManageStatus = "active" | "scheduled" | "disabled";

export interface ManageRow {
  task: Task;
  status: ManageStatus;
  /** 最新一段区间的起止日期。 */
  start: string;
  end: string | null;
  intervalCount: number;
}

/**
 * 任务管理表（Requirements §4.5）：一行一个任务，显示最新区间的起止；
 * 多段区间只展示最后一段，用「N 段」提示历史段仍保留。
 */
export function buildManageRows(tasks: Task[], today: string): ManageRow[] {
  return [...tasks]
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
    .map((task) => {
      const latest = task.intervals.reduce<Task["intervals"][number] | null>(
        (current, interval) =>
          current === null || interval.start >= current.start ? interval : current,
        null,
      );
      const status: ManageStatus = isRetired(task, today)
        ? "disabled"
        : latest && latest.start > today
          ? "scheduled"
          : "active";

      return {
        task,
        status,
        start: latest?.start ?? "",
        end: latest?.end ?? null,
        intervalCount: task.intervals.length,
      };
    });
}

export function useManageRows(): { today: string; rows: ManageRow[] } {
  const tasks = useTasksStore((state) => state.tasks);
  const settings = useSettingsStore((state) => state.settings);

  return useMemo(
    () => {
      const today = logicalToday(new Date(), settings.dayStartHour);
      return { today, rows: buildManageRows(tasks, today) };
    },
    [tasks, settings.dayStartHour],
  );
}
