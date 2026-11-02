import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressRing } from "./ProgressRing";

describe("ProgressRing", () => {
  it("shows done / total and exposes an accessible label", () => {
    render(<ProgressRing done={4} total={6} />);

    const ring = screen.getByRole("img", { name: "今日进度 4 / 6" });

    expect(ring).toHaveTextContent("4");
    expect(ring).toHaveTextContent("6");
  });

  it("does not divide by zero when there are no tasks", () => {
    render(<ProgressRing done={0} total={0} />);

    expect(screen.getByRole("img", { name: "今日进度 0 / 0" })).toBeInTheDocument();
  });
});
