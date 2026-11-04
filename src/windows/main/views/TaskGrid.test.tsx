import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkinKey } from "../../../domain/keys";
import {
  DEFAULT_SETTINGS,
  type Checkin,
  type Task,
} from "../../../domain/types";
import { useCheckinsStore } from "../../../stores/checkinsStore";
import { useSettingsStore } from "../../../stores/settingsStore";
import { useTasksStore } from "../../../stores/tasksStore";
import TaskGrid from "./TaskGrid";

const NOW = new Date(2026, 10, 2, 9, 0, 0);
const TODAY = "2026-11-02";

function task(
  id: string,
  name: string,
  category: Task["category"],
  start: string,
  end: string | null,
  order: number,
): Task {
  return {
    id,
    name,
    category,
    intervals: [{ id: `${id}-i`, taskId: id, start, end }],
    order,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function doneToday(): Checkin {
  return {
    id: "c1",
    taskId: "t1",
    date: TODAY,
    status: "done",
    value: null,
    note: null,
    updatedAt: "2026-11-02T00:00:00.000Z",
  };
}

describe("TaskGrid", () => {
  const setStatus = vi.fn(async () => undefined);
  const updateSettings = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    setStatus.mockClear();
    updateSettings.mockClear();

    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      update: updateSettings,
    });
    useTasksStore.setState({
      tasks: [
        task("t1", "引体向上", "voluntary", "2026-10-28", null, 0),
        task("t2", "开会", "forced", "2026-10-01", null, 1),
        task("t3", "跳绳", "voluntary", "2026-09-01", "2026-10-01", 2),
      ],
    });
    useCheckinsStore.setState({
      byKey: new Map([[checkinKey("t1", TODAY), doneToday()]]),
      setStatus,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the three groups in order with the retired group collapsed", () => {
    const { container } = render(<TaskGrid />);

    const headers = Array.from(
      container.querySelectorAll("[data-group-header]"),
    ).map((element) => element.getAttribute("data-group-header"));
    expect(headers).toEqual(["voluntary", "forced", "disabled"]);

    expect(screen.getByText("引体向上")).toBeInTheDocument();
    expect(screen.getByText("开会")).toBeInTheDocument();
    expect(screen.queryByText("跳绳")).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-grid-row="t3"]'),
    ).not.toBeInTheDocument();
  });

  it("expands the retired group on demand", () => {
    const { container } = render(<TaskGrid />);

    fireEvent.click(
      container.querySelector('[data-group-header="disabled"]') as Element,
    );

    expect(screen.getByText("跳绳")).toBeInTheDocument();
    expect(container.querySelector('[data-grid-row="t3"]')).toBeInTheDocument();
  });

  it("marks the today column in the header and body", () => {
    const { container } = render(<TaskGrid />);

    expect(
      container.querySelector(`[data-date-header="${TODAY}"]`),
    ).toHaveAttribute("data-today");

    const todayCell = container.querySelector(
      `[data-task="t1"][data-date="${TODAY}"]`,
    );
    expect(todayCell).toHaveAttribute("data-state", "done");
    expect(todayCell).toHaveAttribute("data-today");
  });

  it("cycles the projected state through setStatus", () => {
    const { container } = render(<TaskGrid />);

    fireEvent.click(
      container.querySelector(
        `[data-task="t1"][data-date="${TODAY}"]`,
      ) as Element,
    );

    expect(setStatus).toHaveBeenCalledWith("t1", TODAY, "missed");
  });

  it("keeps out-of-range cells grey and non-clickable", () => {
    const { container } = render(<TaskGrid />);

    const beforeStart = container.querySelector(
      '[data-task="t1"][data-date="2026-10-27"]',
    );
    expect(beforeStart).toHaveAttribute("data-state", "none");
    expect(beforeStart).toBeDisabled();
  });

  it("follows scrolling to swap the month pill", () => {
    const { container } = render(<TaskGrid />);
    expect(container).toHaveTextContent("2026 年 10 月");

    const scroller = container.querySelector(
      "[data-grid-scroller]",
    ) as HTMLElement;
    scroller.scrollLeft = 395 * 32;
    fireEvent.scroll(scroller);

    expect(container).toHaveTextContent("2026 年 12 月");
  });

  it("zooms with Ctrl + wheel and persists gridZoom", () => {
    const { container } = render(<TaskGrid />);
    const scroller = container.querySelector(
      "[data-grid-scroller]",
    ) as HTMLElement;

    fireEvent.wheel(scroller, { ctrlKey: true, deltaY: -100 });
    expect(updateSettings).toHaveBeenCalledWith({ gridZoom: 34 });

    fireEvent.wheel(scroller, { deltaY: -100 });
    expect(updateSettings).toHaveBeenCalledTimes(1);
  });

  it("keeps the DOM windowed on a 1200-column axis", () => {
    useTasksStore.setState({
      tasks: Array.from({ length: 15 }, (_, index) =>
        task(
          `perf-${index}`,
          `任务${index}`,
          index % 2 === 0 ? "voluntary" : "forced",
          "2020-01-01",
          null,
          index,
        ),
      ),
    });
    useCheckinsStore.setState({ byKey: new Map(), setStatus });

    const { container } = render(<TaskGrid />);
    const cells = container.querySelectorAll("[data-grid-cell]");

    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThanOrEqual(2000);
  });
});
