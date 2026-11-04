import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, type Todo } from "../../../domain/types";
import { useSettingsStore } from "../../../stores/settingsStore";
import { useTodosStore } from "../../../stores/todosStore";
import Todos from "./Todos";

const NOW = new Date(2026, 10, 4, 9, 0, 0); // 周三

function todo(
  id: string,
  dueDate: string | null,
  options: { done?: boolean; completedAt?: string } = {},
): Todo {
  return {
    id,
    title: id,
    dueDate,
    done: options.done ?? false,
    completedAt: options.completedAt ?? null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

describe("Todos", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    useSettingsStore.setState({ settings: DEFAULT_SETTINGS });
    useTodosStore.setState({
      todos: [
        todo("交房租", "2026-11-01"),
        todo("买猫粮", "2026-11-04"),
        todo("预约体检", "2026-11-06"),
        todo("换灯泡", null),
        todo("写周报", "2026-11-04", {
          done: true,
          completedAt: "2026-11-04T01:00:00.000Z",
        }),
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders overdue, today, this week and later in order", () => {
    const { container } = render(<Todos />);

    const groups = Array.from(
      container.querySelectorAll("[data-todo-group]"),
    ).map((element) => element.getAttribute("data-todo-group"));
    expect(groups).toEqual([
      "overdue",
      "today",
      "thisWeek",
      "later",
      "done",
    ]);

    expect(
      container.querySelector('[data-todo-group="overdue"] [data-todo="交房租"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-todo-group="today"] [data-todo="买猫粮"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '[data-todo-group="thisWeek"] [data-todo="预约体检"]',
      ),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-todo-group="later"] [data-todo="换灯泡"]'),
    ).toBeInTheDocument();
  });

  it("shows the overdue bar and day count", () => {
    const { container } = render(<Todos />);
    const row = container.querySelector(
      '[data-todo="交房租"]',
    ) as HTMLElement;

    expect(row).toHaveAttribute("data-overdue");
    expect(row).toHaveTextContent("逾期 3 天");
  });

  it("keeps completed todos collapsed until asked", () => {
    const { container } = render(<Todos />);

    expect(container.querySelector('[data-todo="写周报"]')).not.toBeInTheDocument();
    fireEvent.click(container.querySelector("[data-done-toggle]") as Element);
    expect(container.querySelector('[data-todo="写周报"]')).toBeInTheDocument();
  });

  it("shows an empty state when nothing is pending", () => {
    useTodosStore.setState({
      todos: [todo("写周报", "2026-11-04", { done: true })],
    });

    render(<Todos />);

    expect(screen.getByText("还没有待办")).toBeInTheDocument();
  });
});
