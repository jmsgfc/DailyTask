import { act, fireEvent, render, screen } from "@testing-library/react";
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
import { useUiStore } from "../../../stores/uiStore";
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
  const setNote = vi.fn(async () => undefined);
  const reorder = vi.fn(async () => undefined);
  const updateSettings = vi.fn(
    async (patch: Partial<typeof DEFAULT_SETTINGS>) => {
      void patch;
    },
  );

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    setStatus.mockClear();
    setNote.mockClear();
    reorder.mockClear();
    updateSettings.mockClear();

    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      update: updateSettings,
    });
    useUiStore.setState({
      gridFilter: { category: "all", taskId: null, from: null, to: null },
    });
    useTasksStore.setState({
      tasks: [
        task("t1", "引体向上", "voluntary", "2026-10-28", null, 0),
        task("t2", "开会", "forced", "2026-10-01", null, 1),
        task("t3", "跳绳", "voluntary", "2026-09-01", "2026-10-01", 2),
      ],
      reorder,
    });
    useCheckinsStore.setState({
      byKey: new Map([[checkinKey("t1", TODAY), doneToday()]]),
      setStatus,
      setNote,
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

    expect(
      container.querySelector('[data-grid-row="t1"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-grid-row="t2"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-grid-row="t3"]'),
    ).not.toBeInTheDocument();
  });

  it("expands the retired group on demand", () => {
    const { container } = render(<TaskGrid />);

    fireEvent.click(
      container.querySelector('[data-group-header="disabled"]') as Element,
    );

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
    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(container).toHaveTextContent("2026 年 12 月");
  });

  it("coalesces scroll events into one frame", () => {
    const { container } = render(<TaskGrid />);
    const scroller = container.querySelector(
      "[data-grid-scroller]",
    ) as HTMLElement;

    scroller.scrollLeft = 360 * 32;
    fireEvent.scroll(scroller);
    scroller.scrollLeft = 395 * 32;
    fireEvent.scroll(scroller);

    expect(container).toHaveTextContent("2026 年 10 月");
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(container).toHaveTextContent("2026 年 12 月");
  });

  it("opens the note bubble from a judged cell and saves", () => {
    const { container } = render(<TaskGrid />);
    const noteButton = container.querySelector(
      `[data-note-button="t1|${TODAY}"]`,
    ) as HTMLElement;

    expect(noteButton).toBeInTheDocument();
    fireEvent.click(noteButton);
    expect(container.querySelector("[data-note-bubble]")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "备注" }), {
      target: { value: "只做了 5 个" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(setNote).toHaveBeenCalledWith("t1", TODAY, "只做了 5 个");
    expect(
      container.querySelector("[data-note-bubble]"),
    ).not.toBeInTheDocument();
  });

  it("only offers notes on cells that already have a record", () => {
    const { container } = render(<TaskGrid />);

    expect(
      container.querySelector(`[data-note-button="t1|${TODAY}"]`),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-note-button="t1|2026-11-03"]'),
    ).not.toBeInTheDocument();
  });

  it("moves the focused cell with arrows and returns Home to today", () => {
    const { container } = render(<TaskGrid />);
    const todayCell = container.querySelector(
      `[data-task="t1"][data-date="${TODAY}"]`,
    ) as HTMLElement;

    expect(todayCell).toHaveAttribute("tabindex", "0");
    todayCell.focus();
    expect(todayCell).toHaveFocus();

    fireEvent.keyDown(todayCell, { key: "ArrowLeft" });
    const previousDay = container.querySelector(
      '[data-task="t1"][data-date="2026-11-01"]',
    ) as HTMLElement;
    expect(previousDay).toHaveFocus();

    fireEvent.keyDown(previousDay, { key: "ArrowDown" });
    const forcedRow = container.querySelector(
      '[data-task="t2"][data-date="2026-11-01"]',
    ) as HTMLElement;
    expect(forcedRow).toHaveFocus();

    fireEvent.keyDown(forcedRow, { key: "Home" });
    const todayForced = container.querySelector(
      `[data-task="t2"][data-date="${TODAY}"]`,
    ) as HTMLElement;
    expect(todayForced).toHaveFocus();

    fireEvent.keyDown(todayForced, { key: "Escape" });
    expect(container.querySelector("[data-focused]")).not.toBeInTheDocument();
  });

  it("switches between detail and overview modes", () => {
    const { container } = render(<TaskGrid />);
    expect(container.querySelector('[data-mode="detail"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "概览" }));
    expect(updateSettings).toHaveBeenCalledWith({ gridZoom: 16 });
  });

  it("returns to detail on an overview block click", () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, gridZoom: 16 },
      update: updateSettings,
    });
    const { container } = render(<TaskGrid />);

    expect(container.querySelector('[data-mode="overview"]')).toBeInTheDocument();
    fireEvent.click(
      container.querySelector(
        `[data-task="t1"][data-date="${TODAY}"]`,
      ) as Element,
    );

    const patch = updateSettings.mock.calls.at(-1)?.[0];
    expect(patch?.gridZoom).toBe(32);
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

  it("filters rows by category and by task", () => {
    const { container } = render(<TaskGrid />);

    fireEvent.click(
      container.querySelector('[data-filter-category="forced"]') as Element,
    );
    expect(
      container.querySelector('[data-grid-row="t2"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-grid-row="t1"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-group-header="voluntary"]'),
    ).not.toBeInTheDocument();

    fireEvent.click(
      container.querySelector('[data-filter-category="all"]') as Element,
    );
    fireEvent.change(container.querySelector("[data-filter-task]") as Element, {
      target: { value: "t2" },
    });
    expect(
      container.querySelector('[data-grid-row="t2"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-grid-row="t1"]'),
    ).not.toBeInTheDocument();
  });

  it("clips the date axis to the selected range and clears it", () => {
    const { container } = render(<TaskGrid />);

    fireEvent.change(
      container.querySelector("[data-filter-from]") as Element,
      { target: { value: "2026-10-28" } },
    );
    fireEvent.change(
      container.querySelector("[data-filter-to]") as Element,
      { target: { value: "2026-11-02" } },
    );

    expect(
      container.querySelector('[data-date-header="2026-10-27"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-date-header="2026-10-28"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-date-header="2026-11-02"]'),
    ).toBeInTheDocument();

    fireEvent.click(
      container.querySelector("[data-filter-clear]") as Element,
    );
    expect(
      container.querySelector('[data-date-header="2026-10-27"]'),
    ).toBeInTheDocument();
  });

  it("shows an empty state when filters exclude every row", () => {
    const { container } = render(<TaskGrid />);

    fireEvent.change(container.querySelector("[data-filter-task]") as Element, {
      target: { value: "t2" },
    });
    fireEvent.click(
      container.querySelector('[data-filter-category="voluntary"]') as Element,
    );

    expect(screen.getByText("没有符合筛选的任务")).toBeInTheDocument();
  });

  it("reorders rows within the same group", () => {
    useTasksStore.setState({
      tasks: [
        task("t1", "引体向上", "voluntary", "2026-10-28", null, 0),
        task("t4", "阅读", "voluntary", "2026-10-01", null, 1),
        task("t2", "开会", "forced", "2026-10-01", null, 2),
        task("t3", "跳绳", "voluntary", "2026-09-01", "2026-10-01", 3),
      ],
      reorder,
    });
    const { container } = render(<TaskGrid />);
    const source = container.querySelector(
      '[data-grid-row="t1"]',
    ) as HTMLElement;
    const target = container.querySelector(
      '[data-grid-row="t4"]',
    ) as HTMLElement;

    fireEvent.dragStart(source.firstElementChild as Element);
    fireEvent.dragOver(target);
    fireEvent.drop(target);

    expect(reorder).toHaveBeenCalledWith(["t4", "t1", "t2", "t3"]);
  });

  it("ignores a drop into another group", () => {
    const { container } = render(<TaskGrid />);
    const source = container.querySelector(
      '[data-grid-row="t1"]',
    ) as HTMLElement;
    const target = container.querySelector(
      '[data-grid-row="t2"]',
    ) as HTMLElement;

    fireEvent.dragStart(source.firstElementChild as Element);
    fireEvent.dragOver(target);
    fireEvent.drop(target);

    expect(reorder).not.toHaveBeenCalled();
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
    useCheckinsStore.setState({ byKey: new Map(), setStatus, setNote });

    const { container } = render(<TaskGrid />);
    const cells = container.querySelectorAll("[data-grid-cell]");

    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThanOrEqual(2000);
  });
});
