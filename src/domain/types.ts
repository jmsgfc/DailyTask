/**
 * 领域实体：与数据库行结构解耦，字段命名遵 Requirements.md §6。
 * 这里只放类型与默认值，不放任何 IO 或业务计算。
 */

export type TaskCategory = "voluntary" | "forced";
export type CheckinStatus = "done" | "missed" | "skipped";
export type Theme = "light" | "dark" | "system";

/** 启用区间；end 为 null 表示至今有效。 */
export interface Interval {
  id: string;
  taskId: string;
  start: string;
  end: string | null;
}

export interface Task {
  id: string;
  name: string;
  category: TaskCategory;
  intervals: Interval[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Checkin {
  id: string;
  taskId: string;
  date: string;
  status: CheckinStatus;
  note: string | null;
  updatedAt: string;
}

export interface Todo {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  theme: Theme;
  gridZoom: number;
  autoSettleMissed: boolean;
  dayStartHour: number;
  alwaysOnTop: boolean;
  autoLaunch: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  gridZoom: 32,
  autoSettleMissed: true,
  dayStartHour: 4,
  alwaysOnTop: true,
  autoLaunch: false,
};
