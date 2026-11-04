import { describe, expect, it } from "vitest";

import { validateInterval } from "./intervals";

describe("validateInterval", () => {
  it("accepts an open-ended interval", () => {
    expect(validateInterval("2026-11-04", null, null)).toBeNull();
    expect(validateInterval("2026-11-04", "2026-11-30", null)).toBeNull();
  });

  it("rejects an end date before the start date", () => {
    expect(validateInterval("2026-11-04", "2026-11-03", null)).toBe(
      "endBeforeStart",
    );
  });

  it("requires a start date", () => {
    expect(validateInterval("", null, null)).toBe("emptyStart");
  });

  it("rejects overlap with the previous segment", () => {
    expect(validateInterval("2026-10-01", null, "2026-10-01")).toBe(
      "overlapsPrevious",
    );
    expect(validateInterval("2026-10-02", null, "2026-10-01")).toBeNull();
  });
});
