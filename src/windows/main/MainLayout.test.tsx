import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useUiStore } from "../../stores/uiStore";
import { useUpdateStore } from "../../stores/updateStore";
import { MainLayout } from "./MainLayout";

describe("MainLayout", () => {
  beforeEach(() => {
    useUiStore.setState({ view: "today" });
    useUpdateStore.setState({ available: null });
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
});
