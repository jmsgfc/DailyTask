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
  const create = vi.fn(async () => ({}) as Todo);
  const update = vi.fn(async () => undefined);
  const setDone = vi.fn(async () => undefined);
  const remove = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    create.mockClear();
    update.mockClear();
    setDone.mockClear();
    remove.mockClear();

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
      create,
      update,
      setDone,
      remove,
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

  it("adds a todo from the quick form", () => {
    const { container } = render(<Todos />);
    const input = screen.getByLabelText("添加待办，回车保存");

    fireEvent.change(input, { target: { value: "  买菜  " } });
    fireEvent.change(container.querySelector("[data-todo-due]") as Element, {
      target: { value: "2026-11-05" },
    });
    fireEvent.click(container.querySelector("[data-todo-add]") as Element);

    expect(create).toHaveBeenCalledWith({
      title: "买菜",
      dueDate: "2026-11-05",
    });
    expect(input).toHaveValue("");
  });

  it("submits with Enter and blocks blank titles", () => {
    const { container } = render(<Todos />);
    const input = screen.getByLabelText("添加待办，回车保存");

    expect(container.querySelector("[data-todo-add]")).toBeDisabled();

    fireEvent.change(input, { target: { value: "倒垃圾" } });
    fireEvent.submit(container.querySelector("[data-todo-form]") as Element);

    expect(create).toHaveBeenCalledWith({
      title: "倒垃圾",
      dueDate: null,
    });
  });

  it("toggles a todo done inline", () => {
    const { container } = render(<Todos />);

    fireEvent.click(
      container.querySelector(
        '[data-todo="买猫粮"] [data-toggle-done]',
      ) as Element,
    );

    expect(setDone).toHaveBeenCalledWith("买猫粮", true);
  });

  it("renames a todo in place", () => {
    const { container } = render(<Todos />);

    fireEvent.click(
      container.querySelector(
        '[data-todo="买猫粮"] [data-todo-rename]',
      ) as Element,
    );
    const input = screen.getByRole("textbox", { name: "重命名" });
    fireEvent.change(input, { target: { value: "买狗粮" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(update).toHaveBeenCalledWith("买猫粮", { title: "买狗粮" });
  });

  it("deletes a todo", () => {
    const { container } = render(<Todos />);

    fireEvent.click(
      container.querySelector(
        '[data-todo="换灯泡"] [data-todo-delete]',
      ) as Element,
    );

    expect(remove).toHaveBeenCalledWith("换灯泡");
  });

  it("reschedules a todo from the right-click menu", () => {
    const { container } = render(<Todos />);

    fireEvent.contextMenu(
      container.querySelector('[data-todo="买猫粮"]') as Element,
    );
    expect(container.querySelector("[data-todo-menu]")).toBeInTheDocument();

    fireEvent.change(container.querySelector("[data-menu-date]") as Element, {
      target: { value: "2026-11-10" },
    });
    fireEvent.click(container.querySelector("[data-menu-save]") as Element);

    expect(update).toHaveBeenCalledWith("买猫粮", { dueDate: "2026-11-10" });
    expect(container.querySelector("[data-todo-menu]")).not.toBeInTheDocument();
  });

  it("clears and deletes from the right-click menu", () => {
    const { container } = render(<Todos />);

    fireEvent.contextMenu(
      container.querySelector('[data-todo="交房租"]') as Element,
    );
    fireEvent.click(container.querySelector("[data-menu-clear]") as Element);
    expect(update).toHaveBeenCalledWith("交房租", { dueDate: null });

    fireEvent.contextMenu(
      container.querySelector('[data-todo="交房租"]') as Element,
    );
    fireEvent.click(container.querySelector("[data-menu-delete]") as Element);
    expect(remove).toHaveBeenCalledWith("交房租");
  });

  it("closes the right-click menu with Escape", () => {
    const { container } = render(<Todos />);

    fireEvent.contextMenu(
      container.querySelector('[data-todo="买猫粮"]') as Element,
    );
    fireEvent.keyDown(window, { key: "Escape" });

    expect(container.querySelector("[data-todo-menu]")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no todos at all", () => {
    useTodosStore.setState({ todos: [] });

    render(<Todos />);

    expect(screen.getByText("还没有待办")).toBeInTheDocument();
    expect(screen.getByLabelText("添加待办，回车保存")).toBeInTheDocument();
  });
});
