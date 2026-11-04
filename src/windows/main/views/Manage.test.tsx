import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, type Task } from "../../../domain/types";
import { useSettingsStore } from "../../../stores/settingsStore";
import { useTasksStore } from "../../../stores/tasksStore";
import Manage from "./Manage";

const NOW = new Date(2026, 10, 4, 9, 0, 0);

function task(
  id: string,
  name: string,
  category: Task["category"],
  order: number,
  intervals: { start: string; end: string | null }[],
): Task {
  return {
    id,
    name,
    category,
    intervals: intervals.map((interval, index) => ({
      id: `${id}-${index}`,
      taskId: id,
      ...interval,
    })),
    order,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("Manage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    useSettingsStore.setState({ settings: DEFAULT_SETTINGS, loaded: true });
    useTasksStore.setState({
      loaded: true,
      tasks: [
        task("t1", "跑步", "voluntary", 0, [
          { start: "2026-09-01", end: "2026-10-01" },
          { start: "2026-10-16", end: null },
        ]),
        task("t2", "开会", "forced", 1, [
          { start: "2026-10-01", end: null },
        ]),
        task("t3", "跳绳", "voluntary", 2, [
          { start: "2026-09-01", end: "2026-10-01" },
        ]),
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders every task with category, dates and status", () => {
    const { container } = render(<Manage />);

    const rows = container.querySelectorAll("[data-manage-row]");
    expect(rows).toHaveLength(3);

    const running = container.querySelector(
      '[data-manage-row="t1"]',
    ) as HTMLElement;
    expect(running).toHaveTextContent("跑步");
    expect(running).toHaveTextContent("自愿");
    expect(running).toHaveTextContent("10/16");
    expect(running).toHaveTextContent("进行中");
    expect(running).toHaveTextContent("2 段");

    expect(
      container.querySelector('[data-manage-row="t2"]'),
    ).toHaveTextContent("被迫");

    const retired = container.querySelector(
      '[data-manage-row="t3"]',
    ) as HTMLElement;
    expect(retired).toHaveAttribute("data-status", "disabled");
    expect(retired).toHaveTextContent("已停用");
    expect(retired).toHaveTextContent("10/01");
  });

  it("shows an empty state without tasks", () => {
    useTasksStore.setState({ tasks: [], loaded: true });

    render(<Manage />);

    expect(screen.getByText("还没有任务")).toBeInTheDocument();
  });
});
