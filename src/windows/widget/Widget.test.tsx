import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkinKey } from "../../domain/keys";
import {
  DEFAULT_SETTINGS,
  type Checkin,
  type CheckinStatus,
  type Settings,
  type Task,
  type Todo,
} from "../../domain/types";
import { useCheckinsStore } from "../../stores/checkinsStore";
import { emitWidgetExpand } from "../../shared/events";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTasksStore } from "../../stores/tasksStore";
import { useTodosStore } from "../../stores/todosStore";
import { CAPSULE_SIDE_KEY, CAPSULE_STORAGE_KEY } from "./capsule";
import { Widget } from "./Widget";

const windowApi = vi.hoisted(() => ({
  setAlwaysOnTop: vi.fn(async () => undefined),
  hide: vi.fn(async () => undefined),
  outerPosition: vi.fn(async () => ({ x: 1480, y: 300 })),
  outerSize: vi.fn(async () => ({ width: 440, height: 560 })),
  setSize: vi.fn(async (size: { width: number; height: number }) => {
    void size;
  }),
  setPosition: vi.fn(async (position: { x: number; y: number }) => {
    void position;
  }),
}));

const monitorApi = vi.hoisted(() => ({
  currentMonitor: vi.fn(async () => ({
    size: { width: 1920, height: 1080 },
    position: { x: 0, y: 0 },
    workArea: {
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1040 },
    },
    scaleFactor: 2,
  })),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => windowApi,
  currentMonitor: monitorApi.currentMonitor,
  PhysicalSize: class {
    constructor(
      public width: number,
      public height: number,
    ) {}
  },
  PhysicalPosition: class {
    constructor(
      public x: number,
      public y: number,
    ) {}
  },
}));

vi.mock("../../shared/events", () => ({
  emitWidgetExpand: vi.fn(async () => undefined),
}));

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
    value: null,
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
    vi.mocked(emitWidgetExpand).mockClear();
    windowApi.setAlwaysOnTop.mockClear();
    windowApi.hide.mockClear();
    windowApi.outerPosition.mockClear();
    windowApi.outerSize.mockClear();
    windowApi.setSize.mockClear();
    windowApi.setPosition.mockClear();
    monitorApi.currentMonitor.mockClear();
    localStorage.removeItem(CAPSULE_STORAGE_KEY);
    localStorage.removeItem(CAPSULE_SIDE_KEY);
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

  it("asks the main window to expand and hides the widget", async () => {
    render(<Widget />);

    fireEvent.click(screen.getByRole("button", { name: "展开主窗口" }));

    expect(emitWidgetExpand).toHaveBeenCalledWith({ source: "widget" });
    await act(async () => undefined);
    expect(windowApi.hide).toHaveBeenCalledTimes(1);
  });

  it("collapses to a right-edge capsule and expands on click", async () => {
    render(<Widget />);

    fireEvent.click(screen.getByRole("button", { name: "收起挂件" }));
    await act(async () => undefined);

    // 200% DPI：96×36 逻辑像素 → 192×72 物理像素，贴右边。
    expect(windowApi.setSize.mock.calls.at(-1)?.[0]).toMatchObject({
      width: 192,
      height: 72,
    });
    expect(windowApi.setPosition.mock.calls.at(-1)?.[0]).toMatchObject({
      x: 1920 - 192,
      y: 300,
    });
    expect(localStorage.getItem(CAPSULE_STORAGE_KEY)).toBe("1");
    expect(
      screen.getByRole("button", { name: /展开挂件/ }),
    ).toHaveAttribute("data-widget-side", "right");

    fireEvent.click(screen.getByRole("button", { name: /展开挂件/ }));
    await act(async () => undefined);

    expect(windowApi.setSize.mock.calls.at(-1)?.[0]).toMatchObject({
      width: 440,
      height: 560,
    });
    expect(localStorage.getItem(CAPSULE_STORAGE_KEY)).toBe("0");
    expect(
      screen.queryByRole("button", { name: /展开挂件/ }),
    ).not.toBeInTheDocument();
  });

  it("restores the capsule on the saved side", async () => {
    localStorage.setItem(CAPSULE_STORAGE_KEY, "1");
    localStorage.setItem(CAPSULE_SIDE_KEY, "left");
    render(<Widget />);
    await act(async () => undefined);

    expect(windowApi.setSize).toHaveBeenCalledWith(
      expect.objectContaining({ width: 192, height: 72 }),
    );
    expect(windowApi.setPosition).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 300 }),
    );
    expect(
      screen.getByRole("button", { name: /展开挂件/ }),
    ).toHaveAttribute("data-widget-side", "left");
  });

  it("drags the capsule instead of expanding when the pointer moves", async () => {
    render(<Widget />);
    fireEvent.click(screen.getByRole("button", { name: "收起挂件" }));

    const capsule = screen.getByRole("button", { name: /展开挂件/ });
    const pointer = (type: string, x: number, y: number) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperties(event, {
        screenX: { value: x },
        screenY: { value: y },
        clientX: { value: x },
        clientY: { value: y },
        button: { value: 0 },
        pointerId: { value: 1 },
      });
      return event;
    };

    fireEvent(capsule, pointer("pointerdown", 100, 100));
    await act(async () => undefined);
    fireEvent(capsule, pointer("pointermove", 220, 100));

    expect(windowApi.setPosition).toHaveBeenCalledWith(
      expect.objectContaining({ x: 1600, y: 300 }),
    );

    fireEvent(capsule, pointer("pointerup", 220, 100));
    await act(async () => undefined);
    fireEvent.click(capsule);

    // 拖动后的 click 不应触发展开。
    expect(
      screen.getByRole("button", { name: /展开挂件/ }),
    ).toBeInTheDocument();
  });

  it("toggles always-on-top and hides the widget", async () => {
    vi.useRealTimers();
    const update = vi.fn(async (patch: Partial<Settings>) => {
      useSettingsStore.setState({
        settings: { ...useSettingsStore.getState().settings, ...patch },
      });
    });
    useSettingsStore.setState({ update });

    render(<Widget />);

    await waitFor(() =>
      expect(windowApi.setAlwaysOnTop).toHaveBeenCalledWith(true),
    );

    fireEvent.click(screen.getByRole("button", { name: "取消置顶" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ alwaysOnTop: false }),
    );
    await waitFor(() =>
      expect(windowApi.setAlwaysOnTop).toHaveBeenCalledWith(false),
    );

    fireEvent.click(screen.getByRole("button", { name: "最小化挂件" }));
    expect(windowApi.hide).toHaveBeenCalledTimes(1);
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
