import { create } from "zustand";

import { getDb } from "../db/client";
import * as repo from "../db/todos";
import type { Todo } from "../domain/types";
import type { DeleteConfirmation } from "../shared/deleteConfirmation";
import { currentSource, emitTodosChanged } from "../shared/events";
import { enqueueWrite } from "../shared/queue";

function notifyTodosChanged(): void {
  void emitTodosChanged({ source: currentSource() }).catch(() => undefined);
}

export interface TodosState {
  todos: Todo[];
  loaded: boolean;
  hydrate: (todos: Todo[]) => void;
  /** 跨窗口收到失效信号后重查；只替换数据，不再回发事件。 */
  reload: () => Promise<void>;
  create: (input: { title: string; dueDate: string | null }) => Promise<Todo>;
  update: (id: string, patch: { title?: string; dueDate?: string | null }) => Promise<void>;
  setDone: (id: string, done: boolean) => Promise<void>;
  remove: (id: string, confirmation: DeleteConfirmation) => Promise<void>;
}

const now = () => new Date().toISOString();

export const useTodosStore = create<TodosState>()((set, get) => ({
  todos: [],
  loaded: false,

  hydrate: (todos) => set({ todos, loaded: true }),

  reload: async () => {
    const todos = await repo.listTodos(await getDb());
    set({ todos, loaded: true });
  },

  create: (input) =>
    enqueueWrite(async () => {
      const todo = await repo.createTodo(await getDb(), input);
      set({ todos: [...get().todos, todo] });
      notifyTodosChanged();
      return todo;
    }),

  update: (id, patch) =>
    enqueueWrite(async () => {
      await repo.updateTodo(await getDb(), id, patch);
      const stamp = now();
      set({
        todos: get().todos.map((todo) =>
          todo.id === id ? { ...todo, ...patch, updatedAt: stamp } : todo,
        ),
      });
      notifyTodosChanged();
    }),

  setDone: (id, done) =>
    enqueueWrite(async () => {
      await repo.setTodoDone(await getDb(), id, done);
      const stamp = now();
      set({
        todos: get().todos.map((todo) =>
          todo.id === id
            ? {
                ...todo,
                done,
                completedAt: done ? stamp : null,
                updatedAt: stamp,
              }
            : todo,
        ),
      });
      notifyTodosChanged();
    }),

  remove: (id, confirmation) =>
    enqueueWrite(async () => {
      void confirmation;
      await repo.deleteTodo(await getDb(), id);
      set({ todos: get().todos.filter((todo) => todo.id !== id) });
      notifyTodosChanged();
    }),
}));
