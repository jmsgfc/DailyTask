import { beforeEach, describe, expect, it } from "vitest";

import {
  CAPSULE_HEIGHT,
  CAPSULE_STORAGE_KEY,
  CAPSULE_WIDTH,
  computeWidgetPlacement,
  EXPANDED_HEIGHT,
  EXPANDED_WIDTH,
  readCollapsedPreference,
  writeCollapsedPreference,
} from "./capsule";

const WORK_AREA = { x: 0, y: 0, width: 1920, height: 1040 };

describe("computeWidgetPlacement", () => {
  it("grows leftwards from the current right edge at 200% DPI", () => {
    const placement = computeWidgetPlacement(WORK_AREA, 2, 1920, 300, true);

    expect(placement).toEqual({
      width: CAPSULE_WIDTH * 2,
      height: CAPSULE_HEIGHT * 2,
      x: 1920 - CAPSULE_WIDTH * 2,
      y: 300,
    });
  });

  it("keeps the right edge when expanding", () => {
    const placement = computeWidgetPlacement(WORK_AREA, 1, 1920, 500, false);

    expect(placement).toMatchObject({
      width: EXPANDED_WIDTH,
      height: EXPANDED_HEIGHT,
      x: 1920 - EXPANDED_WIDTH,
      y: 500,
    });
  });

  it("honours a dragged capsule's right edge", () => {
    const placement = computeWidgetPlacement(WORK_AREA, 1, 1000, 300, true);

    expect(placement.x).toBe(1000 - CAPSULE_WIDTH);
  });

  it("clamps the window inside the work area", () => {
    const low = computeWidgetPlacement(
      WORK_AREA,
      1,
      1920,
      WORK_AREA.height + 100,
      false,
    );
    const left = computeWidgetPlacement(WORK_AREA, 1, 10, 300, false);
    const high = computeWidgetPlacement(WORK_AREA, 1, 1920, -200, true);

    expect(low.y).toBe(WORK_AREA.height - EXPANDED_HEIGHT);
    expect(left.x).toBe(0);
    expect(high.y).toBe(0);
  });

  it("honours a secondary monitor's offset", () => {
    const placement = computeWidgetPlacement(
      { x: 1920, y: -200, width: 1280, height: 1024 },
      1,
      3200,
      -100,
      true,
    );

    expect(placement.x).toBe(1920 + 1280 - CAPSULE_WIDTH);
    expect(placement.y).toBe(-100);
  });
});

describe("collapsed preference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips through localStorage", () => {
    expect(readCollapsedPreference()).toBe(false);

    writeCollapsedPreference(true);
    expect(localStorage.getItem(CAPSULE_STORAGE_KEY)).toBe("1");
    expect(readCollapsedPreference()).toBe(true);

    writeCollapsedPreference(false);
    expect(readCollapsedPreference()).toBe(false);
  });
});
