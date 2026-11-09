import { beforeEach, describe, expect, it, vi } from "vitest";

import { VIEW_STORAGE_KEY } from "./uiStore";

describe("uiStore view persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("defaults to today when nothing is stored", async () => {
    const { useUiStore } = await import("./uiStore");

    expect(useUiStore.getState().view).toBe("today");
  });

  it("restores the last view from localStorage", async () => {
    localStorage.setItem(VIEW_STORAGE_KEY, "stats");

    const { useUiStore } = await import("./uiStore");

    expect(useUiStore.getState().view).toBe("stats");
  });

  it("ignores unknown stored views", async () => {
    localStorage.setItem(VIEW_STORAGE_KEY, "nope");

    const { useUiStore } = await import("./uiStore");

    expect(useUiStore.getState().view).toBe("today");
  });

  it("writes the view on setView", async () => {
    const { useUiStore } = await import("./uiStore");

    useUiStore.getState().setView("grid");

    expect(localStorage.getItem(VIEW_STORAGE_KEY)).toBe("grid");
  });
});
