import { create } from "zustand";

import { getDb } from "../db/client";
import * as repo from "../db/tasks";
import type { Task, TaskCategory } from "../domain/types";
import { currentSource, emitTasksChanged } from "../shared/events";
import { enqueueWrite } from "../shared/queue";

function notifyTasksChanged(): void {
  void emitTasksChanged({ source: currentSource() }).catch(() => undefined);
}

export interface TasksState {
  tasks: Task[];
  loaded: boolean;
  hydrate: (tasks: Task[]) => void;
  /** 跨窗口收到失效信号后重查；只替换数据，不再回发事件。 */
  reload: () => Promise<void>;
  create: (input: {
    name: string;
    category: TaskCategory;
    startDate: string;
  }) => Promise<Task>;
  update: (
    id: string,
    patch: { name?: string; category?: TaskCategory; order?: number },
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  closeInterval: (taskId: string, endDate: string) => Promise<void>;
  appendInterval: (taskId: string, startDate: string) => Promise<void>;
  /** 按传入的全局顺序重排任务（拖拽排序）。 */
  reorder: (taskIds: string[]) => Promise<void>;
}

const now = () => new Date().toISOString();

export const useTasksStore = create<TasksState>()((set, get) => ({
  tasks: [],
  loaded: false,

  hydrate: (tasks) => set({ tasks, loaded: true }),

  reload: async () => {
    const tasks = await repo.listTasks(await getDb());
    set({ tasks, loaded: true });
  },

  create: (input) =>
    enqueueWrite(async () => {
      const task = await repo.createTask(await getDb(), input);
      set({ tasks: [...get().tasks, task] });
      notifyTasksChanged();
      return task;
    }),

  update: (id, patch) =>
    enqueueWrite(async () => {
      await repo.updateTask(await getDb(), id, patch);
      set({
        tasks: get().tasks.map((task) =>
          task.id === id ? { ...task, ...patch, updatedAt: now() } : task,
        ),
      });
      notifyTasksChanged();
    }),

  remove: (id) =>
    enqueueWrite(async () => {
      await repo.deleteTask(await getDb(), id);
      set({ tasks: get().tasks.filter((task) => task.id !== id) });
      notifyTasksChanged();
    }),

  closeInterval: (taskId, endDate) =>
    enqueueWrite(async () => {
      await repo.closeOpenInterval(await getDb(), taskId, endDate);
      const stamp = now();
      set({
        tasks: get().tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                updatedAt: stamp,
                intervals: task.intervals.map((interval) =>
                  interval.end === null ? { ...interval, end: endDate } : interval,
                ),
              }
            : task,
        ),
      });
      notifyTasksChanged();
    }),

  appendInterval: (taskId, startDate) =>
    enqueueWrite(async () => {
      const interval = await repo.appendInterval(
        await getDb(),
        taskId,
        startDate,
      );
      const stamp = now();
      set({
        tasks: get().tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                updatedAt: stamp,
                intervals: [...task.intervals, interval],
              }
            : task,
        ),
      });
      notifyTasksChanged();
    }),

  reorder: (taskIds) =>
    enqueueWrite(async () => {
      await repo.reorderTasks(await getDb(), taskIds);
      const orders = new Map(taskIds.map((id, index) => [id, index]));
      const stamp = now();
      set({
        tasks: get().tasks.map((task) =>
          orders.has(task.id)
            ? { ...task, order: orders.get(task.id) as number, updatedAt: stamp }
            : task,
        ),
      });
      notifyTasksChanged();
    }),
}));
