import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setLocale } from "../shared/i18n";
import { useTrayLabels } from "./useTrayLabels";

const core = vi.hoisted(() => ({
  invoke: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/api/core", () => core);

describe("useTrayLabels", () => {
  afterEach(() => {
    core.invoke.mockClear();
    setLocale("zh-CN");
  });

  it("sends Chinese labels on mount", async () => {
    renderHook(() => useTrayLabels());

    await waitFor(() =>
      expect(core.invoke).toHaveBeenCalledWith("set_tray_labels", {
        showMain: "显示主窗口",
        hideMain: "隐藏主窗口",
        showWidget: "显示挂件",
        hideWidget: "隐藏挂件",
        quit: "退出",
      }),
    );
  });

  it("re-sends labels after switching to English", async () => {
    renderHook(() => useTrayLabels());
    await waitFor(() => expect(core.invoke).toHaveBeenCalled());

    act(() => setLocale("en"));

    await waitFor(() =>
      expect(core.invoke).toHaveBeenLastCalledWith("set_tray_labels", {
        showMain: "Show main window",
        hideMain: "Hide main window",
        showWidget: "Show widget",
        hideWidget: "Hide widget",
        quit: "Quit",
      }),
    );
  });
});
