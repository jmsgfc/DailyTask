import { describe, expect, it } from "vitest";

import {
  computeHorizontalWindow,
  scrollLeftForToday,
} from "./useHorizontalWindow";

describe("computeHorizontalWindow", () => {
  it("renders the first screen plus three screens of overscan", () => {
    const win = computeHorizontalWindow(0, 832, 1000, 32);

    expect(win.start).toBe(0);
    expect(win.end).toBe(21 + 63);
    expect(win.leftPad).toBe(0);
    expect(win.rightPad).toBe((1000 - 84) * 32);
  });

  it("follows the scroll position and keeps pads aligned", () => {
    const win = computeHorizontalWindow(500 * 32, 832, 1000, 32);

    expect(win.start).toBe(437);
    expect(win.end).toBe(584);
    expect(win.leftPad).toBe(437 * 32);
    expect(win.rightPad).toBe((1000 - 584) * 32);
    expect(win.leftPad + (win.end - win.start) * 32 + win.rightPad).toBe(
      1000 * 32,
    );
  });

  it("clamps at the end of the axis", () => {
    const win = computeHorizontalWindow(10_000_000, 832, 1000, 32);

    expect(win.end).toBe(1000);
    expect(win.rightPad).toBe(0);
  });

  it("returns an empty window for an empty axis", () => {
    expect(computeHorizontalWindow(0, 832, 0, 32)).toEqual({
      start: 0,
      end: 0,
      leftPad: 0,
      rightPad: 0,
    });
  });
});

describe("scrollLeftForToday", () => {
  it("keeps four future days visible on the right", () => {
    // 21 visible columns, today at index 365 → first visible = 365 - 17.
    expect(scrollLeftForToday(365, 832, 32)).toBe((365 - 17) * 32);
  });

  it("never scrolls before the axis start", () => {
    expect(scrollLeftForToday(3, 832, 32)).toBe(0);
  });
});
