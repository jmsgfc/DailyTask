import { describe, expect, it } from "vitest";

import { checkinKey } from "../../domain/keys";
import type { Checkin, CheckinStatus, Task, Todo } from "../../domain/types";
import { DEFAULT_SETTINGS } from "../../domain/types";
import { buildToday } from "./today";

const NOW = new Date(2026, 10, 2, 9, 0, 0);
const TODAY = "2026-11-02";

function task(
  id: string,
  name: string,
  category: "voluntary" | "forced",
  order: number,
  start = "2026-11-01",
  end: string | null = null,
): Task {
  return {
    id,
    name,
    category,
    intervals: [{ id: `i-${id}`, taskId: id, start, end }],
    order,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

function checkin(id: string, status: CheckinStatus): Checkin {
  return {
    id: `c-${id}`,
    taskId: id,
    date: TODAY,
    status,
    note: null,
    updatedAt: "2026-11-02T00:00:00.000Z",
  };
}

function todo(id: string, dueDate: string | null, done = false): Todo {
  return {
    id,
    title: id,
    dueDate,
    done,
    completedAt: done ? "2026-11-02T00:00:00.000Z" : null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

const tasks = [
  task("v1", "跑步", "voluntary", 1),
  task("v2", "背单词", "voluntary", 0),
  task("f1", "开会", "forced", 2),
  task("old", "已停用", "voluntary", 3, "2026-10-01", "2026-10-31"),
];

const checkins = new Map<string, Checkin>();
checkins.set(checkinKey("v1", TODAY), checkin("v1", "done"));
checkins.set(checkinKey("v2", TODAY), checkin("v2", "skipped"));

describe("buildToday", () => {
  it("splits applicable tasks by category and keeps order", () => {
    const data = buildToday(tasks, checkins, DEFAULT_SETTINGS, [], NOW);

    expect(data.voluntary.map((row) => row.task.id)).toEqual(["v2", "v1"]);
    expect(data.forced.map((row) => row.task.id)).toEqual(["f1"]);
    expect(data.today).toBe(TODAY);
    expect(data.dateLabel).toContain("11/02");
  });

  it("excludes skipped tasks from the category denominator", () => {
    const data = buildToday(tasks, checkins, DEFAULT_SETTINGS, [], NOW);

    expect(data.voluntaryStat).toEqual({ done: 1, total: 1 });
    expect(data.forcedStat).toEqual({ done: 0, total: 1 });
    expect(data.progress).toMatchObject({
      done: 1,
      pending: 1,
      skipped: 1,
      applicable: 3,
    });
  });

  it("groups overdue and today todos, dropping future and done items", () => {
    const todos = [
      todo("future", "2026-11-05"),
      todo("done", TODAY, true),
      todo("today", TODAY),
      todo("overdue", "2026-10-31"),
      todo("no-date", null),
    ];

    const data = buildToday(tasks, checkins, DEFAULT_SETTINGS, todos, NOW);

    expect(data.overdueTodos.map((item) => item.todo.id)).toEqual(["overdue"]);
    expect(data.overdueTodos[0].overdueDays).toBe(2);
    expect(data.todayTodos.map((item) => item.todo.id)).toEqual(["today"]);
    expect(data.dueTodos).toHaveLength(2);
  });
});
