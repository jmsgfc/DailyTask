import { describe, expect, it } from "vitest";

import { checkinKey } from "../../domain/keys";
import {
  DEFAULT_SETTINGS,
  type Checkin,
  type CheckinStatus,
  type Task,
} from "../../domain/types";
import { buildStats } from "./stats";

const NOW = new Date(2026, 10, 10, 9, 0, 0);
const TODAY = "2026-11-10";

function task(id: string, order: number, start = "2026-10-01"): Task {
  return {
    id,
    name: `任务${id}`,
    category: order % 2 === 0 ? "voluntary" : "forced",
    intervals: [{ id: `${id}-i`, taskId: id, start, end: null }],
    order,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

function checkin(taskId: string, date: string, status: CheckinStatus): Checkin {
  return {
    id: `${taskId}-${date}`,
    taskId,
    date,
    status,
    value: null,
    note: null,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

describe("buildStats", () => {
  it("keeps the task order and projects streak plus 30-day rate", () => {
    const tasks = [task("b", 1), task("a", 0)];
    const checkins = new Map<string, Checkin>([
      [checkinKey("a", "2026-11-10"), checkin("a", "2026-11-10", "done")],
      [checkinKey("a", "2026-11-09"), checkin("a", "2026-11-09", "done")],
    ]);

    const data = buildStats(tasks, checkins, DEFAULT_SETTINGS, NOW);

    expect(data.today).toBe(TODAY);
    expect(data.rows.map((row) => row.task.id)).toEqual(["a", "b"]);
    expect(data.rows[0].streak).toBe(2);
    expect(data.rows[0].rate).toBeCloseTo(2 / 30);
    expect(data.rows[1].streak).toBe(0);
  });

  it("does not count skipped days against the rate", () => {
    const tasks = [task("a", 0)];
    const checkins = new Map<string, Checkin>([
      [checkinKey("a", "2026-11-10"), checkin("a", "2026-11-10", "skipped")],
      [checkinKey("a", "2026-11-09"), checkin("a", "2026-11-09", "done")],
    ]);

    const data = buildStats(tasks, checkins, DEFAULT_SETTINGS, NOW);

    expect(data.rows[0].streak).toBe(1);
    expect(data.rows[0].rate).toBeCloseTo(1 / 29);
  });
});
