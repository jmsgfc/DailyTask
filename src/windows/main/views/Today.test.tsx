import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, type Todo } from "../../../domain/types";
import { useCheckinsStore } from "../../../stores/checkinsStore";
import { useSettingsStore } from "../../../stores/settingsStore";
import { useTasksStore } from "../../../stores/tasksStore";
import { useTodosStore } from "../../../stores/todosStore";
import Today from "./Today";

const NOW = new Date(2026, 10, 2, 9, 0, 0);
const TODAY = "2026-11-02";

function todo(id: string, dueDate: string | null, done = false): Todo {
  return {
    id,
    title: id,
    dueDate,
    done,
    completedAt: done ? "2026-11-02T00:00:00.000Z" : null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

describe("Today due todos", () => {
  beforeEach(() => {
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
  });

  it("renders overdue before today in one block and drops future/done items", () => {
    const { container } = render(<Today />);

    const rows = Array.from(container.querySelectorAll("[data-group]"));
    expect(rows.map((row) => row.getAttribute("data-group"))).toEqual([
      "overdue",
      "today",
    ]);
    expect(rows[0]).toHaveTextContent("交房租");
    expect(rows[0]).toHaveTextContent("逾期 2 天");
    expect(rows[1]).toHaveTextContent("买猫粮");
    expect(rows[1]).toHaveTextContent("今天");

    expect(screen.queryByText("以后再说")).not.toBeInTheDocument();
    expect(screen.queryByText("已完成的待办")).not.toBeInTheDocument();
  });
});
