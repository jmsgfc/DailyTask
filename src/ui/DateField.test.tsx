import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DateField, parseDateText } from "./DateField";

describe("parseDateText", () => {
  it("accepts ISO and slash/dot separators", () => {
    expect(parseDateText("2026-11-05")).toBe("2026-11-05");
    expect(parseDateText("2026/11/5")).toBe("2026-11-05");
    expect(parseDateText("2026.1.5")).toBe("2026-01-05");
  });

  it("rejects impossible or malformed dates", () => {
    expect(parseDateText("2026-02-31")).toBeNull();
    expect(parseDateText("abc")).toBeNull();
    expect(parseDateText("")).toBeNull();
  });
});

describe("DateField", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 10, 5, 9, 0, 0) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits a valid typed date", () => {
    const onChange = vi.fn();
    render(<DateField value={null} onChange={onChange} aria-label="日期" />);

    fireEvent.change(screen.getByLabelText("日期"), {
      target: { value: "2026/11/5" },
    });

    expect(onChange).toHaveBeenCalledWith("2026-11-05");
  });

  it("opens the calendar and picks a day", () => {
    const onChange = vi.fn();
    const { container } = render(
      <DateField value="2026-11-05" onChange={onChange} aria-label="日期" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "选择日期" }));

    expect(
      screen.getByRole("dialog", { name: "选择日期" }),
    ).toBeInTheDocument();
    expect(container).toHaveTextContent("2026 年 11 月");

    fireEvent.click(
      container.querySelector('[data-date="2026-11-20"]') as Element,
    );

    expect(onChange).toHaveBeenCalledWith("2026-11-20");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("switches months with the wheel and updates the header", () => {
    const { container } = render(
      <DateField value="2026-11-05" onChange={vi.fn()} aria-label="日期" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "选择日期" }));
    const popover = screen.getByRole("dialog");

    fireEvent.wheel(popover, { deltaY: 120 });
    expect(container).toHaveTextContent("2026 年 12 月");

    fireEvent.wheel(popover, { deltaY: -120 });
    expect(container).toHaveTextContent("2026 年 11 月");
  });

  it("disables days outside min and max", () => {
    const { container } = render(
      <DateField
        value="2026-11-05"
        min="2026-11-10"
        max="2026-11-20"
        onChange={vi.fn()}
        aria-label="日期"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "选择日期" }));

    expect(
      container.querySelector('[data-date="2026-11-09"]'),
    ).toBeDisabled();
    expect(
      container.querySelector('[data-date="2026-11-10"]'),
    ).toBeEnabled();
    expect(
      container.querySelector('[data-date="2026-11-21"]'),
    ).toBeDisabled();
  });

  it("clears the value", () => {
    const onChange = vi.fn();
    render(
      <DateField
        value="2026-11-05"
        onChange={onChange}
        allowClear
        aria-label="日期"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "选择日期" }));
    fireEvent.click(screen.getByRole("button", { name: "清除" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("closes on Escape and on an outside click", () => {
    render(<DateField value={null} onChange={vi.fn()} aria-label="日期" />);

    fireEvent.click(screen.getByRole("button", { name: "选择日期" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "选择日期" }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("jumps back to today from the footer", () => {
    const onChange = vi.fn();
    render(
      <DateField value="2026-10-01" onChange={onChange} aria-label="日期" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "选择日期" }));
    fireEvent.click(screen.getByRole("button", { name: "今天" }));

    expect(onChange).toHaveBeenCalledWith("2026-11-05");
  });
});
