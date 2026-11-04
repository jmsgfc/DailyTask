import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkinKey } from "../domain/keys";
import {
  DEFAULT_SETTINGS,
  type Checkin,
  type Task,
} from "../domain/types";
import { useCheckinsStore } from "../stores/checkinsStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useTasksStore } from "../stores/tasksStore";
import { useTrayProgress } from "./useTrayProgress";

const core = vi.hoisted(() => ({ invoke: vi.fn(async () => undefined) }));
vi.mock("@tauri-apps/api/core", () => core);

const NOW = new Date(2026, 10, 4, 9, 0, 0);

function task(id: string): Task {
  return {
    id,
    name: id,
    category: "voluntary",
    intervals: [{ id: `${id}-i`, taskId: id, start: "2026-10-01", end: null }],
    order: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

function done(taskId: string): Checkin {
  return {
    id: `c-${taskId}`,
    taskId,
    date: "2026-11-04",
    status: "done",
    value: null,
    note: null,
    updatedAt: "2026-11-04T00:00:00.000Z",
  };
}

function Probe() {
  useTrayProgress();
  return null;
}

describe("useTrayProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, shouldAdvanceTime: true });
    core.invoke.mockClear();

    useSettingsStore.setState({ settings: DEFAULT_SETTINGS });
    useTasksStore.setState({ tasks: [task("a"), task("b"), task("c")] });
    useCheckinsStore.setState({
      byKey: new Map([[checkinKey("a", "2026-11-04"), done("a")]]),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pushes today's progress to the tray", async () => {
    render(<Probe />);

    await waitFor(() =>
      expect(core.invoke).toHaveBeenCalledWith("set_tray_progress", {
        text: "今日进度 1/3",
      }),
    );
  });

  it("updates the tray label when a check-in lands", async () => {
    render(<Probe />);
    await waitFor(() =>
      expect(core.invoke).toHaveBeenCalledWith("set_tray_progress", {
        text: "今日进度 1/3",
      }),
    );

    act(() => {
      useCheckinsStore.setState({
        byKey: new Map([
          [checkinKey("a", "2026-11-04"), done("a")],
          [checkinKey("b", "2026-11-04"), done("b")],
        ]),
      });
    });

    await waitFor(() =>
      expect(core.invoke).toHaveBeenCalledWith("set_tray_progress", {
        text: "今日进度 2/3",
      }),
    );
  });
});
