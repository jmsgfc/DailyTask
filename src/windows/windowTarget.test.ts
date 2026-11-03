import { describe, expect, it } from "vitest";

import { windowTarget } from "./windowTarget";

describe("windowTarget", () => {
  it("defaults to the main window", () => {
    expect(windowTarget("")).toBe("main");
    expect(windowTarget("?window=main")).toBe("main");
  });

  it("detects the widget query parameter", () => {
    expect(windowTarget("?window=widget")).toBe("widget");
  });
});
