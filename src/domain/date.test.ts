import { describe, expect, it } from "vitest";

import {
  addDays,
  diffDays,
  formatDate,
  logicalToday,
  range,
} from "./date";

describe("logicalToday", () => {
  it("treats 03:59 as the previous day when dayStartHour is 4", () => {
    const now = new Date(2026, 10, 2, 3, 59, 0);

    expect(logicalToday(now, 4)).toBe("2026-11-01");
  });

  it("treats 04:00 as the new day", () => {
    const now = new Date(2026, 10, 2, 4, 0, 0);

    expect(logicalToday(now, 4)).toBe("2026-11-02");
  });

  it("handles dayStartHour = 0", () => {
    const now = new Date(2026, 10, 2, 0, 1, 0);

    expect(logicalToday(now, 0)).toBe("2026-11-02");
  });
});

describe("formatDate", () => {
  it("uses local calendar date, not UTC", () => {
    expect(formatDate(new Date(2026, 0, 1, 23, 30, 0))).toBe("2026-01-01");
  });
});

describe("addDays", () => {
  it("moves ±1 day across month and year boundaries", () => {
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("diffDays", () => {
  it("counts calendar days between two dates", () => {
    expect(diffDays("2026-11-05", "2026-11-02")).toBe(3);
    expect(diffDays("2026-11-02", "2026-11-05")).toBe(-3);
    expect(diffDays("2027-01-01", "2026-12-31")).toBe(1);
  });
});

describe("range", () => {
  it("returns an inclusive range", () => {
    expect(range("2026-11-01", "2026-11-03")).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
  });

  it("returns empty when start is after end", () => {
    expect(range("2026-11-03", "2026-11-01")).toEqual([]);
  });
});
