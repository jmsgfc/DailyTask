import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkinKey } from "../../domain/keys";
import {
  DEFAULT_SETTINGS,
  type Checkin,
  type CheckinStatus,
  type Task,
  type Todo,
} from "../../domain/types";
import { useCheckinsStore } from "../../stores/checkinsStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTasksStore } from "../../stores/tasksStore";
import { useTodosStore } from "../../stores/todosStore";
import { Widget } from "./Widget";

const NOW = new Date(2026, 10, 2, 9, 0, 0);
const TODAY = "2026-11-02";
const originalSetStatus = useCheckinsStore.getState().setStatus;

function task(
  id: string,
  name: string,
  category: "voluntary" | "forced",
  order: number,
): Task {
  return {
    id,
    name,
    category,
    intervals: [{ id: `i-${id}`, taskId: id, start: "2026-11-01", end: null }],
    order,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

function checkin(id: string, status: CheckinStatus): Checkin {
  return {
    id: `c-${id}`,
    taskId: id,
    date: TODAY,
    status,
    note: null,
    updatedAt: "2026-11-02T00:00:00.000Z",
  };
}

function todo(id: string, dueDate: string): Todo {
  return {
    id,
    title: id,
    dueDate,
    done: false,
    completedAt: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

function seedStores() {
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS });
  useTasksStore.setState({
    tasks: [
      task("t1", "跑步", "voluntary", 0),
      task("t2", "开会", "forced", 1),
      task("t3", "背单词", "voluntary", 2),
      task("t4", "交周报", "forced", 3),
    ],
  });
  useCheckinsStore.setState({
    byKey: new Map([
      [checkinKey("t2", TODAY), checkin("t2", "done")],
      [checkinKey("t3", TODAY), checkin("t3", "skipped")],
      [checkinKey("t4", TODAY), checkin("t4", "missed")],
    ]),
  });
  useTodosStore.setState({
    todos: [todo("交房租", "2026-10-31"), todo("买猫粮", TODAY)],
  });
}

describe("Widget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    seedStores();
  });

  afterEach(() => {
    vi.useRealTimers();
    useCheckinsStore.setState({ setStatus: originalSetStatus });
  });

  it("renders progress, incomplete tasks, completed fold and due todos", () => {
    render(<Widget />);

    expect(screen.getByText(/11\/02/)).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("还剩 2 项")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "完成 跑步" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "完成 交周报" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("背单词")).not.toBeInTheDocument();

    expect(screen.getByText("1 项已完成")).toBeInTheDocument();
    expect(screen.getByText("交房租")).toBeInTheDocument();
    expect(screen.getByText("逾期 2 天")).toBeInTheDocument();
    expect(screen.getByText("买猫粮")).toBeInTheDocument();
  });

  it("writes a checkin through the store when a task is clicked", () => {
    const setStatus = vi.fn(async () => undefined);
    useCheckinsStore.setState({ setStatus });
    render(<Widget />);

    fireEvent.click(screen.getByRole("button", { name: "完成 跑步" }));

    expect(setStatus).toHaveBeenCalledWith("t1", TODAY, "done");
  });

  it("shows an empty state when nothing is scheduled", () => {
    useTasksStore.setState({ tasks: [] });
    useCheckinsStore.setState({ byKey: new Map() });
    useTodosStore.setState({ todos: [] });

    render(<Widget />);

    expect(screen.getByText("今天没有任务")).toBeInTheDocument();
    expect(screen.getByText("0 / 0")).toBeInTheDocument();
    expect(screen.getByText("今天已收尾")).toBeInTheDocument();
  });
});
