import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Widget } from "./Widget";

describe("Widget", () => {
  it("renders a standalone paper shell without touching the stores", () => {
    render(<Widget />);

    expect(screen.getByText("DailyTask")).toBeInTheDocument();
    expect(screen.getByText("220 × 280")).toBeInTheDocument();
  });
});
