import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import type { SqlDatabase } from "../db/client";
import {
  deleteCheckin,
  listCheckins,
  setCheckinNote,
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
const MIGRATION_004 = readFileSync(
  resolve(process.cwd(), "src-tauri/migrations/004_drop_recorded_status.sql"),
  "utf8",
);

/** 用 Node 内置 SQLite 跑真实 UNIQUE/upsert，避免只测 SQL 字符串。 */
function createDb(): SqlDatabase {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(MIGRATION);
  sqlite.exec(MIGRATION_002);
  sqlite.exec(MIGRATION_004);
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

describe("checkin note", () => {
  it("updates the note without touching status or value", async () => {
    const db = createDb();
    await upsertCheckin(db, {
      taskId: "t1",
      date: "2026-11-02",
      status: "done",
    });
    await setCheckinValue(db, "t1", "2026-11-02", "4");

    const saved = await setCheckinNote(db, "t1", "2026-11-02", " 只跑了 1km ");

    expect(saved).toMatchObject({
      status: "done",
      value: "4",
      note: "只跑了 1km",
    });
  });

  it("clears the note but keeps the checkin row", async () => {
    const db = createDb();
    await upsertCheckin(db, {
      taskId: "t1",
      date: "2026-11-02",
      status: "missed",
      note: "临时有事",
    });

    const saved = await setCheckinNote(db, "t1", "2026-11-02", "   ");

    expect(saved).toMatchObject({ status: "missed", note: null });
    expect(await listCheckins(db)).toHaveLength(1);
  });

  it("does not create a row for an empty cell", async () => {
    const db = createDb();

    expect(await setCheckinNote(db, "t1", "2026-11-02", "备注")).toBeNull();
    expect(await listCheckins(db)).toEqual([]);
  });
});

describe("checkin value", () => {
  it("creates a done row for a value-only cell", async () => {
    const db = createDb();

    const saved = await setCheckinValue(db, "t1", "2026-11-02", "3min");

    expect(saved).toMatchObject({ status: "done", value: "3min" });
    expect(await listCheckins(db)).toMatchObject([
      { taskId: "t1", date: "2026-11-02", status: "done", value: "3min" },
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

  it("keeps the done status when its value is cleared", async () => {
    const db = createDb();
    await setCheckinValue(db, "t1", "2026-11-02", "4");

    const cleared = await setCheckinValue(db, "t1", "2026-11-02", null);

    expect(cleared).toMatchObject({ status: "done", value: null });
    expect(await listCheckins(db)).toMatchObject([
      { taskId: "t1", date: "2026-11-02", status: "done", value: null },
    ]);
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

describe("004_drop_recorded_status", () => {
  it("converts legacy recorded rows to done and keeps value/note", () => {
    const sqlite = new DatabaseSync(":memory:");
    sqlite.exec(MIGRATION);
    sqlite.exec(MIGRATION_002);
    sqlite.exec(
      "INSERT INTO tasks (id, name, category, sort_order, created_at, updated_at) " +
        "VALUES ('t1', '跑步', 'voluntary', 0, '2026-11-01', '2026-11-01')",
    );
    sqlite.exec(
      "INSERT INTO checkins (id, task_id, date, status, value, note, updated_at) " +
        "VALUES ('c1', 't1', '2026-11-02', 'recorded', '3min', '备注', '2026-11-02')",
    );

    sqlite.exec(MIGRATION_004);

    const row = sqlite
      .prepare(
        "SELECT id, task_id, date, status, value, note FROM checkins WHERE id = 'c1'",
      )
      .get();
    expect(row).toEqual({
      id: "c1",
      task_id: "t1",
      date: "2026-11-02",
      status: "done",
      value: "3min",
      note: "备注",
    });
    sqlite.close();
  });
});
