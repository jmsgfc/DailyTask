import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, type Theme } from "../../../domain/types";
import { useSettingsStore } from "../../../stores/settingsStore";
import Settings from "./Settings";

describe("Settings", () => {
  const update = vi.fn(async (patch: { theme?: Theme }) => {
    void patch;
  });

  beforeEach(() => {
    update.mockClear();
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
});
