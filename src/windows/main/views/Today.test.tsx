import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  type Checkin,
  type Task,
  type Todo,
} from "../../../domain/types";
import { checkinKey } from "../../../domain/keys";
import { useCheckinsStore } from "../../../stores/checkinsStore";
import { useSettingsStore } from "../../../stores/settingsStore";
import { useTasksStore } from "../../../stores/tasksStore";
import { useTodosStore } from "../../../stores/todosStore";
import Today from "./Today";

const NOW = new Date(2026, 10, 2, 9, 0, 0);
const TODAY = "2026-11-02";
const originalSetDone = useTodosStore.getState().setDone;

function todo(id: string, dueDate: string | null, done = false): Todo {
  return {
    id,
    title: id,
    dueDate,
    done,
    completedAt: done ? new Date(2026, 10, 2, 9, 0, 0).toISOString() : null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

describe("Today due todos", () => {  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    useSettingsStore.setState({ settings: DEFAULT_SETTINGS });
    useTasksStore.setState({ tasks: [] });
    useCheckinsStore.setState({ byKey: new Map() });
    useTodosStore.setState({
      todos: [
        todo("买猫粮", TODAY),
        todo("交房租", "2026-10-31"),
        todo("以后再说", "2026-11-06"),
        todo("已完成的待办", TODAY, true),
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    useTodosStore.setState({ setDone: originalSetDone });
  });

  it("renders overdue before today in one block and keeps done-today items", () => {
    const { container } = render(<Today />);

    expect(container.querySelector("[data-today-scroll]")).toHaveClass(
      "overflow-y-auto",
    );

    const rows = Array.from(container.querySelectorAll("[data-group]"));
    expect(rows.map((row) => row.getAttribute("data-group"))).toEqual([
      "overdue",
      "today",
      "today",
    ]);
    expect(rows[0]).toHaveTextContent("交房租");
    expect(rows[0]).toHaveTextContent("逾期 2 天");
    expect(rows[1]).toHaveTextContent("买猫粮");
    expect(rows[1]).toHaveTextContent("今天");
    expect(rows[2]).toHaveTextContent("已完成的待办");
    expect(rows[2]).toHaveAttribute("data-done");

    expect(screen.queryByText("以后再说")).not.toBeInTheDocument();
  });

  it("completes a due todo when its row is clicked", () => {
    const setDone = vi.fn(async () => undefined);
    useTodosStore.setState({ setDone });

    render(<Today />);
    fireEvent.click(screen.getByRole("button", { name: "完成 交房租" }));

    expect(setDone).toHaveBeenCalledWith("交房租", true);

    fireEvent.click(screen.getByRole("button", { name: "完成 买猫粮" }));
    expect(setDone).toHaveBeenCalledWith("买猫粮", true);
  });

  it("unchecks a todo completed today instead of hiding it", () => {
    const setDone = vi.fn(async () => undefined);
    useTodosStore.setState({ setDone });

    render(<Today />);
    fireEvent.click(
      screen.getByRole("button", { name: "取消完成 已完成的待办" }),
    );

    expect(setDone).toHaveBeenCalledWith("已完成的待办", false);
  });
});

function task(): Task {
  return {
    id: "t1",
    name: "引体向上",
    category: "voluntary",
    intervals: [{ id: "i1", taskId: "t1", start: "2026-11-01", end: null }],
    order: 0,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

function valueCell(value: string | null): Checkin {
  return {
    id: "c1",
    taskId: "t1",
    date: TODAY,
    status: "done",
    value,
    note: null,
    updatedAt: "2026-11-02T00:00:00.000Z",
  };
}

describe("Today values", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    useSettingsStore.setState({ settings: DEFAULT_SETTINGS });
    useTasksStore.setState({ tasks: [task()] });
    useCheckinsStore.setState({
      byKey: new Map([[checkinKey("t1", TODAY), valueCell("3min")]]),
    });
    useTodosStore.setState({ todos: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the free-form value next to the task", () => {
    const { container } = render(<Today />);

    expect(container.querySelector("[data-value]")).toHaveTextContent("3min");
  });

  it("counts a value-only done cell in the progress total", () => {
    render(<Today />);

    expect(screen.getByText(/已完成 1 \/ 1/)).toBeInTheDocument();
  });
});
