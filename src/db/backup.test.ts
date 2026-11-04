import { beforeEach, describe, expect, it, vi } from "vitest";

const files = vi.hoisted(() => ({
  exists: vi.fn(),
  mkdir: vi.fn(),
  copyFile: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  BaseDirectory: { AppData: "AppData" },
  ...files,
}));

import {
  dailyBackupName,
  pickExpiredBackups,
  rotateDailyBackup,
  snapshotBeforeUpdate,
} from "./backup";
import type { SqlDatabase } from "./client";

const NOW = new Date(2026, 10, 4, 9, 0, 0);

function fakeDb(): SqlDatabase {
  return {
    select: async <T>() => [] as T,
    execute: async () => ({ rowsAffected: 0 }),
  };
}

function entry(name: string) {
  return { name, isDirectory: false, isFile: true, isSymlink: false };
}

describe("backup", () => {
  beforeEach(() => {
    files.exists.mockReset().mockResolvedValue(false);
    files.mkdir.mockReset().mockResolvedValue(undefined);
    files.copyFile.mockReset().mockResolvedValue(undefined);
    files.readDir.mockReset().mockResolvedValue([]);
    files.remove.mockReset().mockResolvedValue(undefined);
  });

  it("names daily backups by local date", () => {
    expect(dailyBackupName(NOW)).toBe("dailytask-20261104.db");
  });

  it("keeps seven daily files and never prunes pre-update snapshots", () => {
    const names = [
      "dailytask-20261028.db",
      "dailytask-20261029.db",
      "dailytask-20261030.db",
      "dailytask-20261031.db",
      "dailytask-20261101.db",
      "dailytask-20261102.db",
      "dailytask-20261103.db",
      "dailytask-20261104.db",
      "pre-update-0.1.0.db",
    ];

    expect(pickExpiredBackups(names, 7)).toEqual([
      "dailytask-20261028.db",
    ]);
  });

  it("copies the database once per day", async () => {
    const db = fakeDb();
    const execute = vi.spyOn(db, "execute");
    const result = await rotateDailyBackup(NOW, db);

    expect(execute).toHaveBeenCalledWith("PRAGMA wal_checkpoint(TRUNCATE)");

    expect(files.mkdir).toHaveBeenCalledWith(
      "backup",
      expect.objectContaining({ recursive: true }),
    );
    expect(files.copyFile).toHaveBeenCalledWith(
      "dailytask.db",
      "backup/dailytask-20261104.db",
      expect.objectContaining({
        fromPathBaseDir: "AppData",
        toPathBaseDir: "AppData",
      }),
    );
    expect(result).toMatchObject({
      created: true,
      name: "dailytask-20261104.db",
      removed: [],
    });
  });

  it("does not copy twice on the same day but still prunes", async () => {
    files.exists.mockResolvedValue(true);
    files.readDir.mockResolvedValue([
      entry("dailytask-20261001.db"),
      entry("dailytask-20261002.db"),
      entry("dailytask-20261003.db"),
      entry("dailytask-20261004.db"),
      entry("dailytask-20261005.db"),
      entry("dailytask-20261006.db"),
      entry("dailytask-20261007.db"),
      entry("dailytask-20261008.db"),
    ]);

    const result = await rotateDailyBackup(NOW, fakeDb());

    expect(files.copyFile).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(files.remove).toHaveBeenCalledWith(
      "backup/dailytask-20261001.db",
      expect.objectContaining({ baseDir: "AppData" }),
    );
  });

  it("writes a pre-update snapshot with the target version", async () => {
    const name = await snapshotBeforeUpdate("0.1.1", fakeDb());

    expect(name).toBe("pre-update-0.1.1.db");
    expect(files.copyFile).toHaveBeenCalledWith(
      "dailytask.db",
      "backup/pre-update-0.1.1.db",
      expect.anything(),
    );
  });
});
