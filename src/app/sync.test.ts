import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCheckinsStore } from "../stores/checkinsStore";
import { useTasksStore } from "../stores/tasksStore";
import { useTodosStore } from "../stores/todosStore";
import { startCrossWindowSync } from "./sync";

type Source = "main" | "widget";

const handlers = vi.hoisted(() => ({
  checkins: null as
    | ((payload: { date: string; source: Source }) => void)
    | null,
  tasks: null as ((payload: { source: Source }) => void) | null,
  todos: null as ((payload: { source: Source }) => void) | null,
}));

const stops = vi.hoisted(() => ({
  checkins: vi.fn(),
  tasks: vi.fn(),
  todos: vi.fn(),
}));

vi.mock("../shared/events", () => ({
  currentSource: () => "main" as Source,
  onCheckinsChanged: async (
    handler: (payload: { date: string; source: Source }) => void,
  ) => {
    handlers.checkins = handler;
    return stops.checkins;
  },
  onTasksChanged: async (handler: (payload: { source: Source }) => void) => {
    handlers.tasks = handler;
    return stops.tasks;
  },
  onTodosChanged: async (handler: (payload: { source: Source }) => void) => {
    handlers.todos = handler;
    return stops.todos;
  },
}));

describe("startCrossWindowSync", () => {
  beforeEach(() => {
    handlers.checkins = null;
    handlers.tasks = null;
    handlers.todos = null;
    stops.checkins.mockClear();
    stops.tasks.mockClear();
    stops.todos.mockClear();
  });

  it("reloads on the other window's events and drops its own", async () => {
    const reloadCheckins = vi.fn(async () => undefined);
    const reloadTasks = vi.fn(async () => undefined);
    const reloadTodos = vi.fn(async () => undefined);
    useCheckinsStore.setState({ reload: reloadCheckins });
    useTasksStore.setState({ reload: reloadTasks });
    useTodosStore.setState({ reload: reloadTodos });

    const stop = await startCrossWindowSync();

    handlers.checkins?.({ date: "2026-11-02", source: "main" });
    handlers.tasks?.({ source: "main" });
    handlers.todos?.({ source: "main" });
    expect(reloadCheckins).not.toHaveBeenCalled();
    expect(reloadTasks).not.toHaveBeenCalled();
    expect(reloadTodos).not.toHaveBeenCalled();

    handlers.checkins?.({ date: "2026-11-02", source: "widget" });
    handlers.tasks?.({ source: "widget" });
    handlers.todos?.({ source: "widget" });
    expect(reloadCheckins).toHaveBeenCalledTimes(1);
    expect(reloadTasks).toHaveBeenCalledTimes(1);
    expect(reloadTodos).toHaveBeenCalledTimes(1);

    stop();
    expect(stops.checkins).toHaveBeenCalledTimes(1);
    expect(stops.tasks).toHaveBeenCalledTimes(1);
    expect(stops.todos).toHaveBeenCalledTimes(1);
  });
});
