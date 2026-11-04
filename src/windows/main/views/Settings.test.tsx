import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../../../domain/types";
import { useSettingsStore } from "../../../stores/settingsStore";
import { useTransferStore } from "../../../stores/transferStore";
import Settings from "./Settings";

const autostart = vi.hoisted(() => ({
  isEnabled: vi.fn(async () => false),
  enable: vi.fn(async () => undefined),
  disable: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/plugin-autostart", () => autostart);
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeTextFile: vi.fn() }));

describe("Settings", () => {
  const update = vi.fn(async (patch: Partial<typeof DEFAULT_SETTINGS>) => {
    void patch;
  });
  const exportToFile = vi.fn(async () => "C:/Users/me/dailytask.json" as string | null);

  beforeEach(() => {
    update.mockClear();
    exportToFile.mockClear();
    autostart.isEnabled.mockReset().mockResolvedValue(false);
    autostart.enable.mockClear();
    autostart.disable.mockClear();

    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      loaded: true,
      update,
    });
    useTransferStore.setState({ exporting: false, exportToFile });
  });

  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it("marks the configured theme as pressed", () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, theme: "light" },
    });

    render(<Settings />);

    expect(screen.getByRole("button", { name: "浅色" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "深色" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("applies and persists a theme switch", () => {
    const { container } = render(<Settings />);

    fireEvent.click(
      container.querySelector('[data-theme-option="dark"]') as Element,
    );

    expect(update).toHaveBeenCalledWith({ theme: "dark" });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("resolves system back to the OS preference", () => {
    const { container } = render(<Settings />);

    fireEvent.click(
      container.querySelector('[data-theme-option="system"]') as Element,
    );

    expect(update).toHaveBeenCalledWith({ theme: "system" });
    expect(["light", "dark"]).toContain(document.documentElement.dataset.theme);
  });

  it("toggles auto-settle and the day start hour", () => {
    const { container } = render(<Settings />);

    fireEvent.click(
      container.querySelector('[data-setting="auto-settle"]') as Element,
    );
    expect(update).toHaveBeenCalledWith({ autoSettleMissed: false });

    fireEvent.change(container.querySelector('[data-setting="day-start"]') as Element, {
      target: { value: "2" },
    });
    expect(update).toHaveBeenCalledWith({ dayStartHour: 2 });
  });

  it("toggles the widget pin", () => {
    const { container } = render(<Settings />);

    fireEvent.click(
      container.querySelector('[data-setting="always-on-top"]') as Element,
    );

    expect(update).toHaveBeenCalledWith({ alwaysOnTop: false });
  });

  it("reads the OS autostart state and enables it", async () => {
    autostart.isEnabled.mockResolvedValueOnce(false);
    const { container } = render(<Settings />);
    const toggle = container.querySelector(
      '[data-setting="auto-launch"]',
    ) as HTMLElement;

    await waitFor(() => expect(autostart.isEnabled).toHaveBeenCalled());
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);

    await waitFor(() => expect(autostart.enable).toHaveBeenCalled());
    expect(update).toHaveBeenCalledWith({ autoLaunch: true });
  });

  it("reflects an autostart entry that already exists", async () => {
    autostart.isEnabled.mockResolvedValueOnce(true);
    const { container } = render(<Settings />);

    await waitFor(() =>
      expect(
        container.querySelector('[data-setting="auto-launch"]'),
      ).toHaveAttribute("aria-checked", "true"),
    );
  });

  it("exports JSON and reports the saved path", async () => {
    const { container } = render(<Settings />);

    fireEvent.click(container.querySelector("[data-export-json]") as Element);

    await waitFor(() => expect(exportToFile).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        container.querySelector("[data-transfer-note]"),
      ).toHaveTextContent("已导出到 C:/Users/me/dailytask.json"),
    );
  });

  it("reports a failed export", async () => {
    exportToFile.mockRejectedValueOnce(new Error("disk full"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { container } = render(<Settings />);

    fireEvent.click(container.querySelector("[data-export-json]") as Element);

    await waitFor(() =>
      expect(
        container.querySelector("[data-transfer-note]"),
      ).toHaveTextContent("导出失败，请重试"),
    );
    consoleError.mockRestore();
  });
});
