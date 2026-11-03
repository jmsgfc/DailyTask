import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const REQUIREMENTS_7_1: [token: string, light: string, dark: string][] = [
  ["--color-bg", "#FAFAFA", "#1E1E1E"],
  ["--color-surface", "#FFFFFF", "#262626"],
  ["--color-border", "#E5E5E5", "#3A3A3A"],
  ["--color-text", "#1A1A1A", "#F0F0F0"],
  ["--color-text-muted", "#8A8A8A", "#9A9A9A"],
  ["--color-voluntary", "#3D9A62", "#4CAF7D"],
  ["--color-forced", "#6B7A99", "#8CA0C4"],
  ["--color-missed", "#D9534F", "#E06C68"],
  ["--color-na", "#EDEDED", "#333333"],
];

describe("main window tokens", () => {
  it("stays identical to the design source", () => {
    expect(read("src/ui/tokens.css")).toBe(read("design/tokens.css"));
  });

  it("matches the light and dark palette in Requirements §7.1", () => {
    const css = read("src/ui/tokens.css");

    for (const [token, light, dark] of REQUIREMENTS_7_1) {
      expect(css).toContain(`${token}: ${light};`);
      expect(css).toContain(`${token}: ${dark};`);
    }
  });

  it("keeps the shared radius and spacing scale from §7.3", () => {
    const css = read("src/ui/tokens.css");

    for (const [token, value] of [
      ["--space-1", "4px"],
      ["--space-2", "8px"],
      ["--space-3", "12px"],
      ["--space-4", "16px"],
      ["--space-6", "24px"],
      ["--radius-control", "6px"],
      ["--radius-card", "10px"],
      ["--radius-widget", "16px"],
    ]) {
      expect(css).toContain(`${token}: ${value};`);
    }
  });
});
