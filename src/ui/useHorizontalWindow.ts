import { useMemo } from "react";

export const TASK_COL_WIDTH = 160;

export interface HorizontalWindow {
  /** 起始列（含）。 */
  start: number;
  /** 结束列（不含）。 */
  end: number;
  leftPad: number;
  rightPad: number;
}

/**
 * 横向虚拟化窗口：可视区 ±3 屏 overscan。
 * scrollLeft 是滚动容器的内容坐标；日期列 i 的内容坐标 = 任务列 + i * cellSize。
 */
export function computeHorizontalWindow(
  scrollLeft: number,
  viewportWidth: number,
  total: number,
  cellSize: number,
  taskColWidth = TASK_COL_WIDTH,
): HorizontalWindow {
  if (total <= 0) {
    return { start: 0, end: 0, leftPad: 0, rightPad: 0 };
  }

  const dateViewport = Math.max(0, viewportWidth - taskColWidth);
  const visible = Math.max(1, Math.ceil(dateViewport / cellSize));
  const overscan = visible * 3;
  const firstVisible = Math.floor(Math.max(0, scrollLeft) / cellSize);

  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(total, firstVisible + visible + overscan);

  return {
    start,
    end,
    leftPad: start * cellSize,
    rightPad: (total - end) * cellSize,
  };
}

export function useHorizontalWindow(
  scrollLeft: number,
  viewportWidth: number,
  total: number,
  cellSize: number,
): HorizontalWindow {
  return useMemo(
    () => computeHorizontalWindow(scrollLeft, viewportWidth, total, cellSize),
    [scrollLeft, viewportWidth, total, cellSize],
  );
}

/** 打开时滚到今天，右侧留 4 天。 */
export function scrollLeftForToday(
  todayIndex: number,
  viewportWidth: number,
  cellSize: number,
  taskColWidth = TASK_COL_WIDTH,
  trailing = 4,
): number {
  const dateViewport = Math.max(0, viewportWidth - taskColWidth);
  const visible = Math.max(0, Math.floor(dateViewport / cellSize));
  return Math.max(0, (todayIndex - Math.max(visible - trailing, 0)) * cellSize);
}
