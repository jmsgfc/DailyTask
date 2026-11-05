import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../domain/types";
import type { SqlDatabase } from "./client";
import {
  getSettings,
  sanitizeSettings,
  setSetting,
} from "./settings";

const noopDb: SqlDatabase = {
  select: async <T>() => [] as T,
  execute: async () => ({ rowsAffected: 0 }),
};

describe("sanitizeSettings", () => {
  it("falls back to defaults when storage is empty", () => {
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("merges valid fields and ignores unknown or bad values", () => {
    const settings = sanitizeSettings({
      theme: "dark",
      language: "en",
      gridZoom: 40,
      autoSettleMissed: false,
      dayStartHour: 25,
      unknown: "ignored",
    });

    expect(settings.theme).toBe("dark");
    expect(settings.language).toBe("en");
    expect(settings.gridZoom).toBe(40);
    expect(settings.autoSettleMissed).toBe(false);
    expect(settings.dayStartHour).toBe(DEFAULT_SETTINGS.dayStartHour);
    expect(settings.autoLaunch).toBe(DEFAULT_SETTINGS.autoLaunch);
  });

  it("falls back for an unsupported language", () => {
    expect(sanitizeSettings({ language: "fr" }).language).toBe(
      DEFAULT_SETTINGS.language,
    );
  });

  it("clamps gridZoom into [14, 44]", () => {
    expect(sanitizeSettings({ gridZoom: 4 }).gridZoom).toBe(14);
    expect(sanitizeSettings({ gridZoom: 100 }).gridZoom).toBe(44);
  });

  it("keeps a string navOrder and rejects mixed values", () => {
    const order = ["settings", "today", "grid", "todos", "manage", "stats"];

    expect(sanitizeSettings({ navOrder: order }).navOrder).toEqual(order);
    expect(sanitizeSettings({ navOrder: ["today", 3] }).navOrder).toEqual([]);
  });
});

describe("getSettings", () => {
  it("parses stored JSON and tolerates a broken row", async () => {
    const db: SqlDatabase = {
      select: async <T>() =>
        [
          { key: "theme", value: '"light"' },
          { key: "gridZoom", value: "28" },
          { key: "dayStartHour", value: "not-json" },
        ] as T,
      execute: async () => ({ rowsAffected: 0 }),
    };

    const settings = await getSettings(db);

    expect(settings.theme).toBe("light");
    expect(settings.gridZoom).toBe(28);
    expect(settings.dayStartHour).toBe(DEFAULT_SETTINGS.dayStartHour);
  });
});

describe("setSetting", () => {
  it("upserts the JSON encoded value", async () => {
    const executed: unknown[][] = [];
    const db: SqlDatabase = {
      ...noopDb,
      execute: async (_query, values = []) => {
        executed.push(values);
        return { rowsAffected: 1 };
      },
    };

    await setSetting(db, "dayStartHour", 6);

    expect(executed[0]).toEqual(["dayStartHour", "6"]);
  });
});
