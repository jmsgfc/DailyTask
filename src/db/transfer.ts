import type {
  Checkin,
  Interval,
  Settings,
  Task,
  Todo,
} from "../domain/types";
import type { SqlDatabase } from "./client";
import { listCheckins } from "./checkins";
import { getSettings } from "./settings";
import { listTasks } from "./tasks";
import { listTodos } from "./todos";

/** JSON v1：任务与区间分开放，导入时可以按 id upsert。 */
export interface ExportTask {
  id: string;
  name: string;
  category: Task["category"];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  tasks: ExportTask[];
  intervals: Interval[];
  checkins: Checkin[];
  todos: Todo[];
  settings: Settings;
}

export function buildExportBundle(
  tasks: Task[],
  checkins: Checkin[],
  todos: Todo[],
  settings: Settings,
  now: Date,
): ExportBundle {
  return {
    version: 1,
    exportedAt: now.toISOString(),
    tasks: tasks.map((task) => ({
      id: task.id,
      name: task.name,
      category: task.category,
      order: task.order,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    })),
    intervals: tasks
      .flatMap((task) => task.intervals)
      .sort((a, b) => a.taskId.localeCompare(b.taskId) || a.start.localeCompare(b.start)),
    checkins: [...checkins].sort(
      (a, b) => a.taskId.localeCompare(b.taskId) || a.date.localeCompare(b.date),
    ),
    todos: [...todos].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    ),
    settings,
  };
}

export async function exportData(
  db: SqlDatabase,
  now = new Date(),
): Promise<ExportBundle> {
  const [tasks, checkins, todos, settings] = await Promise.all([
    listTasks(db),
    listCheckins(db),
    listTodos(db),
    getSettings(db),
  ]);

  return buildExportBundle(tasks, checkins, todos, settings, now);
}
