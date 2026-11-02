import type { Todo } from "../domain/types";
import type { SqlDatabase } from "./client";

export interface TodoRow {
  id: string;
  title: string;
  due_date: string | null;
  done: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function todoFromRow(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.due_date,
    done: row.done === 1,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTodos(db: SqlDatabase): Promise<Todo[]> {
  const rows = await db.select<TodoRow[]>(
    "SELECT id, title, due_date, done, completed_at, created_at, updated_at " +
      "FROM todos ORDER BY done ASC, due_date IS NULL, due_date ASC, created_at ASC",
  );
  return rows.map(todoFromRow);
}

export interface CreateTodoInput {
  title: string;
  dueDate: string | null;
}

export async function createTodo(
  db: SqlDatabase,
  input: CreateTodoInput,
): Promise<Todo> {
  const now = new Date().toISOString();
  const todo: Todo = {
    id: crypto.randomUUID(),
    title: input.title,
    dueDate: input.dueDate,
    done: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.execute(
    "INSERT INTO todos (id, title, due_date, done, completed_at, created_at, updated_at) " +
      "VALUES (?, ?, ?, 0, NULL, ?, ?)",
    [todo.id, todo.title, todo.dueDate, todo.createdAt, todo.updatedAt],
  );
  return todo;
}

export interface TodoPatch {
  title?: string;
  dueDate?: string | null;
}

export async function updateTodo(
  db: SqlDatabase,
  id: string,
  patch: TodoPatch,
): Promise<void> {
  const columns: string[] = [];
  const values: unknown[] = [];

  if (patch.title !== undefined) {
    columns.push("title = ?");
    values.push(patch.title);
  }
  if (patch.dueDate !== undefined) {
    columns.push("due_date = ?");
    values.push(patch.dueDate);
  }
  if (columns.length === 0) {
    return;
  }

  columns.push("updated_at = ?");
  values.push(new Date().toISOString(), id);
  await db.execute(
    `UPDATE todos SET ${columns.join(", ")} WHERE id = ?`,
    values,
  );
}

export async function setTodoDone(
  db: SqlDatabase,
  id: string,
  done: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    "UPDATE todos SET done = ?, completed_at = ?, updated_at = ? WHERE id = ?",
    [done ? 1 : 0, done ? now : null, now, id],
  );
}

export async function deleteTodo(db: SqlDatabase, id: string): Promise<void> {
  await db.execute("DELETE FROM todos WHERE id = ?", [id]);
}
