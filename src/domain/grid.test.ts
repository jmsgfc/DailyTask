import { describe, expect, it } from "vitest";

import {
  buildDateAxis,
  groupTasks,
  GRID_FUTURE_DAYS,
  GRID_MAX_COLUMNS,
  GRID_PAST_DAYS,
  isRetired,
  monthTicks,
} from "./grid";
import { addDays } from "./date";
import type { Interval, Task } from "./types";

const TODAY = "2026-11-02";

function task(
  id: string,
  intervals: Interval[],
  category: Task["category"] = "voluntary",
  order = 0,
): Task {
  return {
    id,
    name: id,
    category,
    intervals,
    order,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function interval(start: string, end: string | null): Interval {
  return { id: `${start}|${end ?? "open"}`, taskId: "t", start, end };
}

describe("buildDateAxis", () => {
  it("falls back to one year of history plus 30 future days", () => {
    const axis = buildDateAxis([], TODAY);

    expect(axis.start).toBe(addDays(TODAY, -GRID_PAST_DAYS));
    expect(axis.end).toBe(addDays(TODAY, GRID_FUTURE_DAYS));
    expect(axis.dates).toHaveLength(GRID_PAST_DAYS + GRID_FUTURE_DAYS + 1);
    expect(axis.todayIndex).toBe(GRID_PAST_DAYS);
    expect(axis.dates[axis.todayIndex]).toBe(TODAY);
  });

  it("extends left to the earliest interval start", () => {
    const start = addDays(TODAY, -500);
    const axis = buildDateAxis([task("old", [interval(start, null)])], TODAY);

    expect(axis.start).toBe(start);
    expect(axis.todayIndex).toBe(500);
  });

  it("extends right to a future re-enable start", () => {
    const future = addDays(TODAY, 60);
    const axis = buildDateAxis([task("later", [interval(future, null)])], TODAY);

    expect(axis.end).toBe(future);
  });

  it("caps at 1200 columns and keeps today inside", () => {
    const axis = buildDateAxis(
      [task("ancient", [interval("2020-01-01", null)])],
      TODAY,
    );

    expect(axis.dates).toHaveLength(GRID_MAX_COLUMNS);
    expect(axis.dates[axis.todayIndex]).toBe(TODAY);
    expect(axis.end).toBe(addDays(TODAY, GRID_FUTURE_DAYS));
  });
});

describe("groupTasks", () => {
  it("splits voluntary, forced and retired rows, keeping order", () => {
    const tasks = [
      task("forced-b", [interval("2026-10-01", null)], "forced", 2),
      task("voluntary", [interval("2026-10-01", null)], "voluntary", 1),
      task("retired", [interval("2026-09-01", "2026-10-01")], "voluntary", 0),
      task("forced-a", [interval("2026-10-01", null)], "forced", 0),
    ];

    const groups = groupTasks(tasks, TODAY);

    expect(groups.voluntary.map((row) => row.task.id)).toEqual(["voluntary"]);
    expect(groups.forced.map((row) => row.task.id)).toEqual([
      "forced-a",
      "forced-b",
    ]);
    expect(groups.disabled.map((row) => row.task.id)).toEqual(["retired"]);
    expect(groups.disabled[0].disabled).toBe(true);
  });

  it("keeps a future-only interval in its category instead of retired", () => {
    const taskSoon = task("soon", [interval(addDays(TODAY, 5), null)]);

    expect(isRetired(taskSoon, TODAY)).toBe(false);
    expect(groupTasks([taskSoon], TODAY).voluntary).toHaveLength(1);
    expect(groupTasks([taskSoon], TODAY).disabled).toHaveLength(0);
  });

  it("treats a task without intervals as retired", () => {
    expect(isRetired(task("empty", []), TODAY)).toBe(true);
  });
});

describe("monthTicks", () => {
  it("marks the first day of every month", () => {
    const ticks = monthTicks(["2026-10-30", "2026-11-01", "2026-11-02"]);

    expect(ticks).toEqual([
      { key: "2026-10", index: 0 },
      { key: "2026-11", index: 1 },
    ]);
  });
});
