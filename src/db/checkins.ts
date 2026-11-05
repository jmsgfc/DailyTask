import { checkinKey } from "../domain/keys";
import type { Checkin, CheckinStatus } from "../domain/types";
import type { SqlDatabase } from "./client";

export { checkinKey };

export interface CheckinRow {
  id: string;
  task_id: string;
  date: string;
  status: CheckinStatus;
  value: string | null;
  note: string | null;
  updated_at: string;
}

export function checkinFromRow(row: CheckinRow): Checkin {
  return {
    id: row.id,
    taskId: row.task_id,
    date: row.date,
    status: row.status,
    value: row.value,
    note: row.note,
    updatedAt: row.updated_at,
  };
}

export function toCheckinMap(rows: CheckinRow[]): Map<string, Checkin> {
  const map = new Map<string, Checkin>();
  for (const row of rows) {
    const checkin = checkinFromRow(row);
    map.set(checkinKey(checkin.taskId, checkin.date), checkin);
  }
  return map;
}

const SELECT_COLUMNS =
  "SELECT id, task_id, date, status, value, note, updated_at FROM checkins";

export async function listCheckins(db: SqlDatabase): Promise<Checkin[]> {
  const rows = await db.select<CheckinRow[]>(SELECT_COLUMNS);
  return rows.map(checkinFromRow);
}

async function readCell(
  db: SqlDatabase,
  taskId: string,
  date: string,
): Promise<Checkin | null> {
  const rows = await db.select<CheckinRow[]>(
    `${SELECT_COLUMNS} WHERE task_id = ? AND date = ?`,
    [taskId, date],
  );
  return rows.length === 0 ? null : checkinFromRow(rows[0]);
}

export interface UpsertCheckinInput {
  taskId: string;
  date: string;
  status: CheckinStatus;
  note?: string | null;
}

/**
 * 同一格只保留一条记录。冲突时更新状态而不是插入新行，
 * 所以「空 → ✓ → ✗」反复点不会撞 UNIQUE。
 * 不触碰 value：判定与记录值相互独立。
 */
export async function upsertCheckin(
  db: SqlDatabase,
  input: UpsertCheckinInput,
): Promise<Checkin> {
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO checkins (id, task_id, date, status, value, note, updated_at) " +
      "VALUES (?, ?, ?, ?, NULL, ?, ?) " +
      "ON CONFLICT(task_id, date) DO UPDATE SET " +
      "status = excluded.status, note = excluded.note, updated_at = excluded.updated_at",
    [
      crypto.randomUUID(),
      input.taskId,
      input.date,
      input.status,
      input.note ?? null,
      now,
    ],
  );

  const saved = await readCell(db, input.taskId, input.date);
  if (saved === null) {
    throw new Error("checkin disappeared after upsert");
  }
  return saved;
}

/**
 * 写入自由值。没有记录时直接建一条 done 行；清空值只清 value，
 * 保留已有的 done/missed/skipped 判定。
 */
export async function setCheckinValue(
  db: SqlDatabase,
  taskId: string,
  date: string,
  value: string | null,
): Promise<Checkin | null> {
  const normalized = value?.trim() ? value.trim() : null;
  const now = new Date().toISOString();

  if (normalized === null) {
    const current = await readCell(db, taskId, date);
    if (current === null) {
      return null;
    }
    await db.execute(
      "UPDATE checkins SET value = NULL, updated_at = ? WHERE task_id = ? AND date = ?",
      [now, taskId, date],
    );
    return readCell(db, taskId, date);
  }

  await db.execute(
    "INSERT INTO checkins (id, task_id, date, status, value, note, updated_at) " +
      "VALUES (?, ?, ?, 'done', ?, NULL, ?) " +
      "ON CONFLICT(task_id, date) DO UPDATE SET " +
      "value = excluded.value, updated_at = excluded.updated_at",
    [crypto.randomUUID(), taskId, date, normalized, now],
  );

  return readCell(db, taskId, date);
}

/**
 * 给已有打卡写备注；没有打卡行时返回 null（备注不单独建行）。
 * 传 null / 空白表示清空备注，保留判定。
 */
export async function setCheckinNote(
  db: SqlDatabase,
  taskId: string,
  date: string,
  note: string | null,
): Promise<Checkin | null> {
  const normalized = note?.trim() ? note.trim() : null;
  const current = await readCell(db, taskId, date);
  if (current === null) {
    return null;
  }

  await db.execute(
    "UPDATE checkins SET note = ?, updated_at = ? WHERE task_id = ? AND date = ?",
    [normalized, new Date().toISOString(), taskId, date],
  );
  return readCell(db, taskId, date);
}

/** 点击循环回到空状态时删除该行。 */
export async function deleteCheckin(
  db: SqlDatabase,
  taskId: string,
  date: string,
): Promise<void> {
  await db.execute("DELETE FROM checkins WHERE task_id = ? AND date = ?", [
    taskId,
    date,
  ]);
}
