import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dateLocale,
  getLocale,
  resolveLanguage,
  setLocale,
  subscribe,
  t,
} from "./index";

afterEach(() => {
  setLocale("zh-CN");
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: "zh-CN",
  });
});

describe("t", () => {
  it("returns the zh-CN message by default", () => {
    expect(t("nav.today")).toBe("今日");
  });

  it("interpolates named variables", () => {
    expect(t("today.doneOfTotal", { done: 4, total: 6 })).toBe(
      "已完成 4 / 6 项",
    );
  });

  it("keeps an unknown placeholder instead of printing undefined", () => {
    expect(t("today.remaining", {})).toContain("{count}");
  });
});

describe("setLocale", () => {
  it("sets document lang and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    setLocale("zh-CN");

    expect(getLocale()).toBe("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("switches to English", () => {
    setLocale("en");

    expect(getLocale()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(t("nav.today")).toBe("Today");
  });

  it("resolves system to English or Chinese", () => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "en-US",
    });
    expect(resolveLanguage("system")).toBe("en");

    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "zh-CN",
    });
    expect(resolveLanguage("system")).toBe("zh-CN");
  });
});

describe("dateLocale", () => {
  it("maps the app language to the date-fns locale", () => {
    expect(dateLocale("zh-CN").code).toBe("zh-CN");
    expect(dateLocale("en").code).toBe("en-US");

    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "en-US",
    });
    expect(dateLocale("system").code).toBe("en-US");
  });
});
