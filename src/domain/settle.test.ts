import { describe, expect, it } from "vitest";

import { checkinKey } from "./keys";
import { dayProgress, projectCell } from "./settle";
import type { Checkin, CheckinStatus, Interval, Settings, Task } from "./types";
import { DEFAULT_SETTINGS } from "./types";

function task(intervals: Interval[]): Task {
  return {
    id: "t1",
    name: "跑步",
    category: "voluntary",
    intervals,
    order: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function open(start: string, end: string | null = null): Interval {
  return { id: "i1", taskId: "t1", start, end };
}

function checkin(status: CheckinStatus): Checkin {
  return {
    id: "c1",
    taskId: "t1",
    date: "2026-11-02",
    status,
    note: null,
    updatedAt: "2026-11-02T00:00:00.000Z",
  };
}

const settings: Settings = { ...DEFAULT_SETTINGS };

describe("projectCell", () => {
  it("returns none outside every interval", () => {
    expect(
      projectCell(
        task([open("2026-11-02", "2026-11-10")]),
        "2026-11-11",
        undefined,
        settings,
        "2026-11-02",
      ),
    ).toBe("none");
  });

  it("lets a stored checkin win over the projection", () => {
    expect(
      projectCell(
        task([open("2026-11-01")]),
        "2026-11-01",
        checkin("done"),
        settings,
        "2026-11-02",
      ),
    ).toBe("done");
  });

  it("returns pending for today and future dates", () => {
    const t = task([open("2026-11-01")]);

    expect(projectCell(t, "2026-11-02", undefined, settings, "2026-11-02")).toBe(
      "pending",
    );
    expect(projectCell(t, "2026-11-03", undefined, settings, "2026-11-02")).toBe(
      "pending",
    );
  });

  it("projects past blanks as missed when auto settle is on", () => {
    const t = task([open("2026-11-01")]);

    expect(projectCell(t, "2026-11-01", undefined, settings, "2026-11-02")).toBe(
      "missed",
    );
  });

  it("keeps past blanks pending when auto settle is off", () => {
    const t = task([open("2026-11-01")]);
    const off = { ...settings, autoSettleMissed: false };

    expect(projectCell(t, "2026-11-01", undefined, off, "2026-11-02")).toBe(
      "pending",
    );
  });
});

describe("dayProgress", () => {
  it("counts only applicable tasks and excludes skipped from the denominator", () => {
    const tasks = [
      task([open("2026-11-01")]),
      task([open("2026-11-01")]),
      task([open("2026-11-01")]),
    ];
    tasks[1].id = "t2";
    tasks[2].id = "t3";

    const checkins = new Map<string, Checkin>();
    checkins.set(checkinKey("t1", "2026-11-02"), checkin("done"));
    checkins.set(checkinKey("t2", "2026-11-02"), checkin("skipped"));

    const progress = dayProgress(
      tasks,
      checkins,
      "2026-11-02",
      settings,
      "2026-11-02",
    );

    expect(progress).toMatchObject({
      done: 1,
      missed: 0,
      skipped: 1,
      pending: 1,
      applicable: 3,
      ratio: 0.5,
    });
  });

  it("returns 0 ratio when nothing is countable", () => {
    const onlySkipped = new Map<string, Checkin>();
    onlySkipped.set(checkinKey("t1", "2026-11-02"), checkin("skipped"));

    expect(
      dayProgress(
        [task([open("2026-11-01")])],
        onlySkipped,
        "2026-11-02",
        settings,
        "2026-11-02",
      ).ratio,
    ).toBe(0);
  });
});
