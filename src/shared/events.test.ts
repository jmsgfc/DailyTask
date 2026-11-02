import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  currentSource,
  emitCheckinsChanged,
  Events,
  onCheckinsChanged,
} from "./events";

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(async () => undefined),
  listen: vi.fn(async (_event: string, handler: (event: { payload: unknown }) => void) => {
    handler({ payload: { date: "2026-11-02", source: "widget" } });
    return () => undefined;
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ label: "widget" }),
}));

describe("events", () => {
  beforeEach(() => {
    vi.mocked(emit).mockClear();
    vi.mocked(listen).mockClear();
  });

  it("emits the event name and typed payload", async () => {
    await emitCheckinsChanged({ date: "2026-11-02", source: "main" });

    expect(emit).toHaveBeenCalledWith(Events.checkinsChanged, {
      date: "2026-11-02",
      source: "main",
    });
  });

  it("forwards the payload to the listener", async () => {
    const handler = vi.fn();

    await onCheckinsChanged(handler);

    expect(listen).toHaveBeenCalledWith(
      Events.checkinsChanged,
      expect.any(Function),
    );
    expect(handler).toHaveBeenCalledWith({
      date: "2026-11-02",
      source: "widget",
    });
  });

  it("derives source from the current window label", () => {
    expect(currentSource()).toBe("widget");
    expect(getCurrentWindow().label).toBe("widget");
  });
});
