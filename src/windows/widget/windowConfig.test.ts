import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

interface WindowConfig {
  label: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  decorations?: boolean;
  transparent?: boolean;
  alwaysOnTop?: boolean;
  skipTaskbar?: boolean;
  url?: string;
}

const readJson = (path: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as {
    app: { windows: WindowConfig[] };
  };

describe("widget window config", () => {
  it("keeps the main window size budget", () => {
    const main = readJson("src-tauri/tauri.conf.json").app.windows.find(
      (window) => window.label === "main",
    );

    expect(main).toMatchObject({
      width: 1080,
      height: 720,
      minWidth: 900,
      minHeight: 640,
    });
  });

  it("creates a borderless, transparent, always-on-top widget", () => {
    const widget = readJson("src-tauri/tauri.conf.json").app.windows.find(
      (window) => window.label === "widget",
    );

    expect(widget).toMatchObject({
      width: 220,
      height: 280,
      url: "index.html?window=widget",
      resizable: false,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
    });
  });

  it("grants the widget window the same capabilities as main", () => {
    const capabilities = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "src-tauri/capabilities/default.json"),
        "utf8",
      ),
    ) as { windows: string[] };

    expect(capabilities.windows).toEqual(["main", "widget"]);
  });
});
