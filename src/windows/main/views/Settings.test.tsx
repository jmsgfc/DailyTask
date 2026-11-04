import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../../../domain/types";
import { useSettingsStore } from "../../../stores/settingsStore";
import Settings from "./Settings";

const autostart = vi.hoisted(() => ({
  isEnabled: vi.fn(async () => false),
  enable: vi.fn(async () => undefined),
  disable: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/plugin-autostart", () => autostart);

describe("Settings", () => {
  const update = vi.fn(async (patch: Partial<typeof DEFAULT_SETTINGS>) => {
    void patch;
  });

  beforeEach(() => {
    update.mockClear();
    autostart.isEnabled.mockReset().mockResolvedValue(false);
    autostart.enable.mockClear();
    autostart.disable.mockClear();

    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      loaded: true,
      update,
    });
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
});
