import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import type { SqlDatabase } from "../db/client";
import {
  deleteCheckin,
  listCheckins,
  setCheckinValue,
  upsertCheckin,
} from "./checkins";

const MIGRATION = readFileSync(
  resolve(process.cwd(), "src-tauri/migrations/001_init.sql"),
  "utf8",
);
const MIGRATION_002 = readFileSync(
  resolve(process.cwd(), "src-tauri/migrations/002_checkin_value.sql"),
  "utf8",
);

/** 用 Node 内置 SQLite 跑真实 UNIQUE/upsert，避免只测 SQL 字符串。 */
function createDb(): SqlDatabase {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(MIGRATION);
  sqlite.exec(MIGRATION_002);
  sqlite.exec(
    "INSERT INTO tasks (id, name, category, sort_order, created_at, updated_at) " +
      "VALUES ('t1', '跑步', 'voluntary', 0, '2026-11-01', '2026-11-01')",
  );

  type BindValue = string | number | bigint | null | Uint8Array;

  return {
    select: async <T>(query: string, values: unknown[] = []) => {
      return sqlite.prepare(query).all(...(values as BindValue[])) as T;
    },
    execute: async (query: string, values: unknown[] = []) => {
      const result = sqlite.prepare(query).run(...(values as BindValue[]));
      return { rowsAffected: Number(result.changes) };
    },
  };
}

describe("upsertCheckin", () => {
  it("overwrites the same cell instead of failing on UNIQUE", async () => {
    const db = createDb();

    await upsertCheckin(db, {
      taskId: "t1",
      date: "2026-11-02",
      status: "done",
    });
    const second = await upsertCheckin(db, {
      taskId: "t1",
      date: "2026-11-02",
      status: "missed",
      note: "只跑了 1km",
    });

    const checkins = await listCheckins(db);
    expect(checkins).toHaveLength(1);
    expect(checkins[0]).toMatchObject({
      taskId: "t1",
      date: "2026-11-02",
      status: "missed",
      note: "只跑了 1km",
    });
    expect(second.id).toBe(checkins[0].id);
  });
});

describe("deleteCheckin", () => {
  it("removes the row so the cell can go back to empty", async () => {
    const db = createDb();
    await upsertCheckin(db, {
      taskId: "t1",
      date: "2026-11-02",
      status: "done",
    });

    await deleteCheckin(db, "t1", "2026-11-02");

    expect(await listCheckins(db)).toEqual([]);
  });
});

describe("checkin value", () => {
  it("creates a recorded row for a value-only cell", async () => {
    const db = createDb();

    const saved = await setCheckinValue(db, "t1", "2026-11-02", "3min");

    expect(saved).toMatchObject({ status: "recorded", value: "3min" });
    expect(await listCheckins(db)).toMatchObject([
      { taskId: "t1", date: "2026-11-02", status: "recorded", value: "3min" },
    ]);
  });

  it("keeps the value when the status changes", async () => {
    const db = createDb();
    await setCheckinValue(db, "t1", "2026-11-02", "4");

    await upsertCheckin(db, {
      taskId: "t1",
      date: "2026-11-02",
      status: "done",
    });

    const [row] = await listCheckins(db);
    expect(row).toMatchObject({ status: "done", value: "4" });
  });

  it("deletes a recorded row when its value is cleared", async () => {
    const db = createDb();
    await setCheckinValue(db, "t1", "2026-11-02", "4");

    const cleared = await setCheckinValue(db, "t1", "2026-11-02", null);

    expect(cleared).toBeNull();
    expect(await listCheckins(db)).toEqual([]);
  });

  it("keeps the judged status when only the value is cleared", async () => {
    const db = createDb();
    await upsertCheckin(db, {
      taskId: "t1",
      date: "2026-11-02",
      status: "done",
    });
    await setCheckinValue(db, "t1", "2026-11-02", "4");

    const cleared = await setCheckinValue(db, "t1", "2026-11-02", null);

    expect(cleared).toMatchObject({ status: "done", value: null });
    expect(await listCheckins(db)).toHaveLength(1);
  });
});
