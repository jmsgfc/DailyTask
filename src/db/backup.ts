import {
  BaseDirectory,
  copyFile,
  exists,
  mkdir,
  readDir,
  remove,
} from "@tauri-apps/plugin-fs";

import { formatDate } from "../domain/date";
import type { SqlDatabase } from "./client";
import { getDb } from "./client";

/** tauri-plugin-sql 把 sqlite 文件放在 AppData（Roaming）根目录。 */
export const DB_FILE = "dailytask.db";
export const BACKUP_DIR = "backup";
export const KEEP_DAILY_BACKUPS = 7;

const DAILY_PATTERN = /^dailytask-\d{8}\.db$/;

export function dailyBackupName(now: Date): string {
  return `dailytask-${formatDate(now).replaceAll("-", "")}.db`;
}

/** 从备份文件名里挑出需要删除的最旧若干份（按 YYYYMMDD 排序）。 */
export function pickExpiredBackups(names: string[], keep: number): string[] {
  const daily = names.filter((name) => DAILY_PATTERN.test(name)).sort();
  return daily.slice(0, Math.max(0, daily.length - keep));
}

export interface DailyBackupResult {
  created: boolean;
  name: string;
  removed: string[];
}

/**
 * 复制前把 WAL 合并回主库，否则备份可能缺少最近的写入。
 * 失败不阻断备份流程，只记日志。
 */
async function checkpoint(db: SqlDatabase): Promise<void> {
  try {
    await db.execute("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch (error) {
    console.warn("[backup] WAL checkpoint 失败", error);
  }
}

/**
 * 每日轮转：每天启动时给数据库留一份快照，同一天不重复写；
 * 只保留最近 7 份，`pre-update-*` 快照不参与清理。
 */
export async function rotateDailyBackup(
  now = new Date(),
  db?: SqlDatabase,
): Promise<DailyBackupResult> {
  const name = dailyBackupName(now);
  const target = `${BACKUP_DIR}/${name}`;
  const alreadyExists = await exists(target, {
    baseDir: BaseDirectory.AppData,
  });

  if (!alreadyExists) {
    await checkpoint(db ?? (await getDb()));
    await mkdir(BACKUP_DIR, {
      baseDir: BaseDirectory.AppData,
      recursive: true,
    });
    await copyFile(DB_FILE, target, {
      fromPathBaseDir: BaseDirectory.AppData,
      toPathBaseDir: BaseDirectory.AppData,
    });
  }

  const entries = await readDir(BACKUP_DIR, {
    baseDir: BaseDirectory.AppData,
  });
  const removed = pickExpiredBackups(
    entries.filter((entry) => entry.isFile).map((entry) => entry.name),
    KEEP_DAILY_BACKUPS,
  );
  for (const expired of removed) {
    await remove(`${BACKUP_DIR}/${expired}`, {
      baseDir: BaseDirectory.AppData,
    });
  }

  return { created: !alreadyExists, name, removed };
}

/** 安装更新前快照；失败时由调用方中止安装。 */
export async function snapshotBeforeUpdate(
  version: string,
  db?: SqlDatabase,
): Promise<string> {
  await checkpoint(db ?? (await getDb()));
  await mkdir(BACKUP_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  const name = `pre-update-${version}.db`;
  await copyFile(DB_FILE, `${BACKUP_DIR}/${name}`, {
    fromPathBaseDir: BaseDirectory.AppData,
    toPathBaseDir: BaseDirectory.AppData,
  });
  return name;
}
