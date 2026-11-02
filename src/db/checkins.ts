import type { Checkin, CheckinStatus } from "../domain/types";
import type { SqlDatabase } from "./client";

export interface CheckinRow {
  id: string;
  task_id: string;
  date: string;
  status: CheckinStatus;
  note: string | null;
  updated_at: string;
}

export function checkinKey(taskId: string, date: string): string {
  return `${taskId}|${date}`;
}

export function checkinFromRow(row: CheckinRow): Checkin {
  return {
    id: row.id,
    taskId: row.task_id,
    date: row.date,
    status: row.status,
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

export async function listCheckins(db: SqlDatabase): Promise<Checkin[]> {
  const rows = await db.select<CheckinRow[]>(
    "SELECT id, task_id, date, status, note, updated_at FROM checkins",
  );
  return rows.map(checkinFromRow);
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
 */
export async function upsertCheckin(
  db: SqlDatabase,
  input: UpsertCheckinInput,
): Promise<Checkin> {
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO checkins (id, task_id, date, status, note, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?) " +
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

  const rows = await db.select<CheckinRow[]>(
    "SELECT id, task_id, date, status, note, updated_at FROM checkins " +
      "WHERE task_id = ? AND date = ?",
    [input.taskId, input.date],
  );
  return checkinFromRow(rows[0]);
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
