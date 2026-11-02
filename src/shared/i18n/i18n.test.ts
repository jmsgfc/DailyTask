import { afterEach, describe, expect, it, vi } from "vitest";

import { dateLocale, getLocale, setLocale, subscribe, t } from "./index";

afterEach(() => {
  setLocale("zh-CN");
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

  it("ignores languages that are not registered yet", () => {
    setLocale("en");

    expect(getLocale()).toBe("zh-CN");
    expect(t("nav.today")).toBe("今日");
  });
});

describe("dateLocale", () => {
  it("maps the app language to the date-fns locale", () => {
    expect(dateLocale("zh-CN").code).toBe("zh-CN");
    expect(dateLocale("en").code).toBe("en-US");
  });
});
