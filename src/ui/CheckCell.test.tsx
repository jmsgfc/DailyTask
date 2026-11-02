import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CheckCell } from "./CheckCell";

describe("CheckCell", () => {
  it("renders a distinct symbol for each settled state", () => {
    const { rerender } = render(
      <CheckCell state="done" taskName="跑步" />,
    );

    expect(screen.getByRole("button")).toHaveTextContent("✓");
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "done");

    rerender(<CheckCell state="missed" taskName="跑步" />);
    expect(screen.getByRole("button")).toHaveTextContent("✗");
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "missed");

    rerender(<CheckCell state="skipped" taskName="跑步" />);
    expect(screen.getByRole("button")).toHaveTextContent("–");
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "skipped");
  });

  it("labels the cell for screen readers", () => {
    render(<CheckCell state="done" taskName="跑步" />);

    expect(
      screen.getByRole("button", { name: "跑步：已完成" }),
    ).toBeInTheDocument();
  });

  it("disables cells outside the applicable interval", () => {
    render(<CheckCell state="none" taskName="跑步" />);

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
