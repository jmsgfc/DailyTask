import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, type Task } from "../../domain/types";
import { buildGridData } from "./grid";

const NOW = new Date(2026, 10, 2, 9, 0, 0);

function task(index: number): Task {
  return {
    id: `t${index}`,
    name: `任务${index}`,
    category: index % 2 === 0 ? "voluntary" : "forced",
    intervals: [
      {
        id: `i${index}`,
        taskId: `t${index}`,
        start: "2020-01-01",
        end: null,
      },
    ],
    order: index,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  };
}

describe("buildGridData", () => {
  it("precomputes the capped 1200-column axis for 15 tasks", () => {
    const tasks = Array.from({ length: 15 }, (_, index) => task(index));
    const started = performance.now();

    const data = buildGridData(tasks, new Map(), DEFAULT_SETTINGS, NOW);
    const elapsed = performance.now() - started;

    expect(data.axis.dates).toHaveLength(1200);
    expect(data.states.size).toBe(1200 * 15);
    expect(data.groups.voluntary).toHaveLength(8);
    expect(data.groups.forced).toHaveLength(7);
    // 宽松上限：只用来拦住 O(n²) 之类的退化，不追求机器无关的精确耗时。
    expect(elapsed).toBeLessThan(500);
  });
});
