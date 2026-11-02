import { describe, expect, it } from "vitest";

import type { SqlDatabase } from "../db/client";
import {
  createTodo,
  listTodos,
  setTodoDone,
  todoFromRow,
  type TodoRow,
} from "./todos";

const todoRow: TodoRow = {
  id: "todo1",
  title: "交周报",
  due_date: "2026-11-06",
  done: 0,
  completed_at: null,
  created_at: "2026-11-02T00:00:00.000Z",
  updated_at: "2026-11-02T00:00:00.000Z",
};

describe("todoFromRow", () => {
  it("maps integer done to boolean and keeps nullable due date", () => {
    expect(todoFromRow(todoRow)).toMatchObject({
      id: "todo1",
      dueDate: "2026-11-06",
      done: false,
      completedAt: null,
    });
  });

  it("maps done = 1 to true", () => {
    expect(todoFromRow({ ...todoRow, done: 1 }).done).toBe(true);
  });
});

describe("createTodo", () => {
  it("inserts a new todo and returns it", async () => {
    const executed: unknown[][] = [];
    const db: SqlDatabase = {
      select: async <T>() => [] as T,
      execute: async (_query, values = []) => {
        executed.push(values);
        return { rowsAffected: 1 };
      },
    };

    const todo = await createTodo(db, {
      title: "交周报",
      dueDate: "2026-11-06",
    });

    expect(todo.done).toBe(false);
    expect(todo.completedAt).toBeNull();
    expect(executed[0]).toContain("交周报");
    expect(executed[0]).toContain("2026-11-06");
  });
});

describe("listTodos", () => {
  it("maps rows in query order", async () => {
    const db: SqlDatabase = {
      select: async <T>() => [todoRow] as T,
      execute: async () => ({ rowsAffected: 0 }),
    };

    const todos = await listTodos(db);

    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe("交周报");
  });
});

describe("setTodoDone", () => {
  it("writes completed_at when done and clears it when reopened", async () => {
    const executed: unknown[][] = [];
    const db: SqlDatabase = {
      select: async <T>() => [] as T,
      execute: async (_query, values = []) => {
        executed.push(values);
        return { rowsAffected: 1 };
      },
    };

    await setTodoDone(db, "todo1", true);
    await setTodoDone(db, "todo1", false);

    expect(executed[0][0]).toBe(1);
    expect(executed[0][1]).toEqual(expect.any(String));
    expect(executed[1][0]).toBe(0);
    expect(executed[1][1]).toBeNull();
  });
});
