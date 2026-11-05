import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

function setup(onConfirm = vi.fn(async () => undefined)) {
  render(
    <ConfirmDeleteButton name="测试项" onConfirm={onConfirm}>
      <span aria-hidden="true">✕</span>
    </ConfirmDeleteButton>,
  );
  return onConfirm;
}

describe("ConfirmDeleteButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens a confirmation dialog before deleting", () => {
    const onConfirm = setup();

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("dialog", { name: "删除「测试项」" })).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does nothing when cancelled", () => {
    const onConfirm = setup();

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms once and closes on success", async () => {
    const onConfirm = setup();

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await act(async () => undefined);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(expect.anything());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open and shows an error on failure", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onConfirm = vi.fn(async () => {
      throw new Error("database is locked");
    });
    setup(onConfirm);

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await act(async () => undefined);

    expect(screen.getByRole("dialog")).toHaveTextContent("删除失败，请重试");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("supports a menuitem trigger", () => {
    render(
      <ConfirmDeleteButton name="菜单项" role="menuitem" onConfirm={vi.fn()}>
        删除
      </ConfirmDeleteButton>,
    );

    expect(screen.getByRole("menuitem", { name: "删除" })).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    setup();

    fireEvent.click(screen.getByRole("button"));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
