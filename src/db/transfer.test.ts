import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  type Checkin,
  type Task,
  type Todo,
} from "../domain/types";
import { buildExportBundle } from "./transfer";

const NOW = new Date(2026, 10, 4, 9, 30, 0);

function task(id: string, order: number): Task {
  return {
    id,
    name: `任务${id}`,
    category: order % 2 === 0 ? "voluntary" : "forced",
    intervals: [
      { id: `${id}-1`, taskId: id, start: "2026-10-01", end: "2026-10-15" },
      { id: `${id}-2`, taskId: id, start: "2026-11-01", end: null },
    ],
    order,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

function checkin(taskId: string, date: string): Checkin {
  return {
    id: `${taskId}-${date}`,
    taskId,
    date,
    status: "done",
    value: null,
    note: null,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

function todo(id: string, createdAt: string): Todo {
  return {
    id,
    title: id,
    dueDate: null,
    done: false,
    completedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("buildExportBundle", () => {
  it("uses JSON v1 with tasks and intervals split apart", () => {
    const bundle = buildExportBundle(
      [task("t1", 0)],
      [checkin("t1", "2026-11-02")],
      [todo("todo-b", "2026-10-02T00:00:00.000Z"), todo("todo-a", "2026-10-01T00:00:00.000Z")],
      DEFAULT_SETTINGS,
      NOW,
    );

    expect(bundle.version).toBe(1);
    expect(bundle.exportedAt).toBe(NOW.toISOString());
    expect(bundle.tasks).toEqual([
      {
        id: "t1",
        name: "任务t1",
        category: "voluntary",
        order: 0,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-11-01T00:00:00.000Z",
      },
    ]);
    expect(bundle.tasks[0]).not.toHaveProperty("intervals");
    expect(bundle.intervals.map((interval) => interval.id)).toEqual([
      "t1-1",
      "t1-2",
    ]);
    expect(bundle.todos.map((item) => item.id)).toEqual(["todo-a", "todo-b"]);
    expect(bundle.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("sorts intervals and checkins by task then date", () => {
    const bundle = buildExportBundle(
      [task("b", 1), task("a", 0)],
      [checkin("a", "2026-11-02"), checkin("a", "2026-11-01"), checkin("b", "2026-11-02")],
      [],
      DEFAULT_SETTINGS,
      NOW,
    );

    expect(
      bundle.intervals.map((interval) => `${interval.taskId}:${interval.start}`),
    ).toEqual([
      "a:2026-10-01",
      "a:2026-11-01",
      "b:2026-10-01",
      "b:2026-11-01",
    ]);
    expect(
      bundle.checkins.map((item) => `${item.taskId}:${item.date}`),
    ).toEqual(["a:2026-11-01", "a:2026-11-02", "b:2026-11-02"]);
  });
});
