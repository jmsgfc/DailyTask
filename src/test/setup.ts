import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

beforeAll(() => {
  // 默认语言是 system；测试固定成中文，避免 jsdom 的 en-US 让中文断言失效。
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: "zh-CN",
  });
});

afterEach(() => {
  cleanup();
});
