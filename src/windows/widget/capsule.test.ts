import { beforeEach, describe, expect, it } from "vitest";

import {
  CAPSULE_HEIGHT,
  CAPSULE_SIDE_KEY,
  CAPSULE_STORAGE_KEY,
  CAPSULE_WIDTH,
  computeWidgetPlacement,
  EXPANDED_HEIGHT,
  EXPANDED_WIDTH,
  nearestSide,
  prepareWidgetStartup,
  readCollapsedPreference,
  readSidePreference,
  writeCollapsedPreference,
  writeSidePreference,
} from "./capsule";

const WORK_AREA = { x: 0, y: 0, width: 1920, height: 1040 };

describe("computeWidgetPlacement", () => {
  it("docks a capsule to the right edge at 200% DPI", () => {
    const placement = computeWidgetPlacement(
      WORK_AREA,
      2,
      "right",
      300,
      true,
    );

    expect(placement).toEqual({
      width: CAPSULE_WIDTH * 2,
      height: CAPSULE_HEIGHT * 2,
      x: 1920 - CAPSULE_WIDTH * 2,
      y: 300,
    });
  });

  it("docks a capsule to the left edge", () => {
    const placement = computeWidgetPlacement(
      WORK_AREA,
      1,
      "left",
      300,
      true,
    );

    expect(placement.x).toBe(0);
  });

  it("expands inwards from the chosen edge", () => {
    const right = computeWidgetPlacement(WORK_AREA, 1, "right", 500, false);
    const left = computeWidgetPlacement(WORK_AREA, 1, "left", 500, false);

    expect(right).toMatchObject({
      width: EXPANDED_WIDTH,
      height: EXPANDED_HEIGHT,
      x: 1920 - EXPANDED_WIDTH,
      y: 500,
    });
    expect(left.x).toBe(0);
  });

  it("clamps the window inside the work area vertically", () => {
    const low = computeWidgetPlacement(
      WORK_AREA,
      1,
      "right",
      WORK_AREA.height + 100,
      false,
    );
    const high = computeWidgetPlacement(WORK_AREA, 1, "left", -200, true);

    expect(low.y).toBe(WORK_AREA.height - EXPANDED_HEIGHT);
    expect(high.y).toBe(0);
  });

  it("honours a secondary monitor's offset", () => {
    const area = { x: 1920, y: -200, width: 1280, height: 1024 };
    const right = computeWidgetPlacement(area, 1, "right", -100, true);
    const left = computeWidgetPlacement(area, 1, "left", -100, true);

    expect(right.x).toBe(1920 + 1280 - CAPSULE_WIDTH);
    expect(right.y).toBe(-100);
    expect(left.x).toBe(1920);
  });
});

describe("nearestSide", () => {
  it("picks the side closest to the window centre", () => {
    expect(nearestSide(100, 440, WORK_AREA)).toBe("left");
    expect(nearestSide(1480, 440, WORK_AREA)).toBe("right");
    expect(nearestSide(739, 440, WORK_AREA)).toBe("left");
    expect(nearestSide(740, 440, WORK_AREA)).toBe("right");
  });
});

describe("preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips the collapsed state", () => {
    expect(readCollapsedPreference()).toBe(false);

    writeCollapsedPreference(true);
    expect(localStorage.getItem(CAPSULE_STORAGE_KEY)).toBe("1");
    expect(readCollapsedPreference()).toBe(true);

    writeCollapsedPreference(false);
    expect(readCollapsedPreference()).toBe(false);
  });

  it("round-trips the docked side", () => {
    expect(readSidePreference()).toBe("right");

    writeSidePreference("left");
    expect(localStorage.getItem(CAPSULE_SIDE_KEY)).toBe("left");
    expect(readSidePreference()).toBe("left");
  });

  it("forces the capsule state on app startup", () => {
    writeCollapsedPreference(false);

    prepareWidgetStartup();

    expect(readCollapsedPreference()).toBe(true);
  });
});
