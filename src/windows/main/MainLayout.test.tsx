import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useUiStore } from "../../stores/uiStore";
import { useUpdateStore } from "../../stores/updateStore";
import { MainLayout } from "./MainLayout";
import { NAV_ORDER_KEY } from "./navOrder";

const navOrder = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-nav-item]")].map((element) =>
    element.getAttribute("data-nav-item"),
  );

describe("MainLayout", () => {
  beforeEach(() => {
    useUiStore.setState({ view: "today" });
    useUpdateStore.setState({ available: null });
    localStorage.clear();
  });

  it("switches between all six views", () => {
    render(<MainLayout />);

    expect(screen.getByRole("heading", { name: "今日" })).toBeInTheDocument();

    for (const [label, heading] of [
      ["任务表", "任务表"],
      ["待办", "待办"],
      ["任务管理", "任务管理"],
      ["统计", "统计"],
      ["设置", "设置"],
      ["今日", "今日"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it("marks the active nav item", () => {
    render(<MainLayout />);

    fireEvent.click(screen.getByRole("button", { name: "统计" }));

    expect(screen.getByRole("button", { name: "统计" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows a red dot on settings when an update is available", () => {
    useUpdateStore.setState({
      available: { version: "0.1.1", notes: null },
    });
    const { container } = render(<MainLayout />);

    expect(container.querySelector("[data-update-dot]")).toBeInTheDocument();
  });

  it("reorders nav items by dragging and remembers the order", () => {
    const { container } = render(<MainLayout />);
    const nav = container.querySelector("nav");
    if (!nav) {
      throw new Error("nav not found");
    }
    nav.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 228,
        height: 228,
        left: 0,
        right: 200,
        width: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const settings = screen.getByRole("button", { name: "设置" });
    const pointer = (type: string, clientY: number) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperties(event, {
        clientY: { value: clientY },
        button: { value: 0 },
        pointerId: { value: 1 },
      });
      return event;
    };

    fireEvent(settings, pointer("pointerdown", 190));
    fireEvent(settings, pointer("pointermove", 100));
    fireEvent(settings, pointer("pointermove", 10));
    fireEvent(settings, pointer("pointerup", 10));

    const expected = ["settings", "today", "grid", "todos", "manage", "stats"];
    expect(navOrder(container)).toEqual(expected);
    expect(JSON.parse(localStorage.getItem(NAV_ORDER_KEY) ?? "[]")).toEqual(
      expected,
    );
  });

  it("restores the saved nav order on mount", () => {
    localStorage.setItem(
      NAV_ORDER_KEY,
      JSON.stringify(["settings", "today", "grid", "todos", "manage", "stats"]),
    );

    const { container } = render(<MainLayout />);

    expect(navOrder(container)[0]).toBe("settings");
  });

  it("moves the focused nav item with Alt+Arrow", () => {
    const { container } = render(<MainLayout />);

    fireEvent.keyDown(screen.getByRole("button", { name: "今日" }), {
      key: "ArrowDown",
      altKey: true,
    });

    expect(navOrder(container).slice(0, 2)).toEqual(["grid", "today"]);
    expect(JSON.parse(localStorage.getItem(NAV_ORDER_KEY) ?? "[]")[1]).toBe(
      "today",
    );
  });
});
