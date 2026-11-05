import type {
  Checkin,
  Interval,
  Settings,
  Task,
  Todo,
} from "../domain/types";
import { normalizeEveryDays } from "../domain/intervals";
import type { SqlDatabase } from "./client";
import { listCheckins } from "./checkins";
import { getSettings, sanitizeSettings, setSettings } from "./settings";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

const CHECKIN_STATUSES = ["done", "missed", "skipped", "recorded"] as const;

function isExportTask(value: unknown): value is ExportTask {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    (value.category === "voluntary" || value.category === "forced") &&
    typeof value.order === "number" &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isInterval(value: unknown): value is Interval {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.taskId) &&
    isString(value.start) &&
    isNullableString(value.end) &&
    (value.everyDays === undefined ||
      (typeof value.everyDays === "number" &&
        Number.isInteger(value.everyDays) &&
        value.everyDays >= 1 &&
        value.everyDays <= 365))
  );
}

function isCheckin(value: unknown): value is Checkin {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.taskId) &&
    isString(value.date) &&
    CHECKIN_STATUSES.includes(value.status as (typeof CHECKIN_STATUSES)[number]) &&
    isNullableString(value.value) &&
    isNullableString(value.note) &&
    isString(value.updatedAt)
  );
}

function isTodo(value: unknown): value is Todo {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.title) &&
    isNullableString(value.dueDate) &&
    typeof value.done === "boolean" &&
    isNullableString(value.completedAt) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function arrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T,
): T[] {
  if (!Array.isArray(value) || !value.every(guard)) {
    throw new Error("invalid-structure");
  }
  return value;
}

/** 导入前的结构校验：版本不对或字段缺失一律拒绝，避免半截数据进库。 */
export function parseImportBundle(text: string): ExportBundle {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("invalid-json");
  }
  if (!isRecord(raw)) {
    throw new Error("invalid-structure");
  }
  if (raw.version !== 1) {
    throw new Error("unsupported-version");
  }

  return {
    version: 1,
    exportedAt: isString(raw.exportedAt) ? raw.exportedAt : new Date().toISOString(),
    tasks: arrayOf(raw.tasks, isExportTask),
    intervals: arrayOf(raw.intervals, isInterval).map((interval) => ({
      ...interval,
      everyDays: normalizeEveryDays(interval.everyDays),
    })),
    checkins: arrayOf(raw.checkins, isCheckin),
    todos: arrayOf(raw.todos, isTodo),
    settings: sanitizeSettings(isRecord(raw.settings) ? raw.settings : {}),
  };
}

export interface ImportCounts {
  tasks: number;
  intervals: number;
  checkins: number;
  todos: number;
}

/**
 * 导入冲突策略：按主键 upsert，本地多出来的行一律保留；
 * 打卡以 (task_id, date) 为语义键，保留本地 id。
 * 全流程幂等，失败后重试同一文件不会产生重复数据。
 */
export async function importData(
  db: SqlDatabase,
  bundle: ExportBundle,
): Promise<ImportCounts> {
  for (const task of bundle.tasks) {
    await db.execute(
      "INSERT INTO tasks (id, name, category, sort_order, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET " +
        "name = excluded.name, category = excluded.category, " +
        "sort_order = excluded.sort_order, updated_at = excluded.updated_at",
      [
        task.id,
        task.name,
        task.category,
        task.order,
        task.createdAt,
        task.updatedAt,
      ],
    );
  }

  for (const interval of bundle.intervals) {
    await db.execute(
      "INSERT INTO task_intervals (id, task_id, start_date, end_date, every_days) " +
        "VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET " +
        "task_id = excluded.task_id, start_date = excluded.start_date, " +
        "end_date = excluded.end_date, every_days = excluded.every_days",
      [
        interval.id,
        interval.taskId,
        interval.start,
        interval.end,
        normalizeEveryDays(interval.everyDays),
      ],
    );
  }

  for (const checkin of bundle.checkins) {
    await db.execute(
      "INSERT INTO checkins (id, task_id, date, status, value, note, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(task_id, date) DO UPDATE SET " +
        "status = excluded.status, value = excluded.value, " +
        "note = excluded.note, updated_at = excluded.updated_at",
      [
        checkin.id,
        checkin.taskId,
        checkin.date,
        checkin.status,
        checkin.value,
        checkin.note,
        checkin.updatedAt,
      ],
    );
  }

  for (const todo of bundle.todos) {
    await db.execute(
      "INSERT INTO todos (id, title, due_date, done, completed_at, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET " +
        "title = excluded.title, due_date = excluded.due_date, " +
        "done = excluded.done, completed_at = excluded.completed_at, " +
        "updated_at = excluded.updated_at",
      [
        todo.id,
        todo.title,
        todo.dueDate,
        todo.done ? 1 : 0,
        todo.completedAt,
        todo.createdAt,
        todo.updatedAt,
      ],
    );
  }

  await setSettings(db, bundle.settings);

  return {
    tasks: bundle.tasks.length,
    intervals: bundle.intervals.length,
    checkins: bundle.checkins.length,
    todos: bundle.todos.length,
  };
}
