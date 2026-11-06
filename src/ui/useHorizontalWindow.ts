import { useMemo } from "react";

import { findColumnAtOffset } from "./gridColumnLayout";

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
 * 横向虚拟化窗口：可视区 ±2 屏 overscan（±3 屏会突破 2k 格 DOM 预算）。
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
  const overscan = visible * 2;
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

/**
 * 可变列宽版本：offsets 是列宽前缀和。
 * 向左右各多渲染两屏像素宽度，保证宽列滚动时不会出现空白。
 */
export function computeHorizontalWindowByOffsets(
  scrollLeft: number,
  viewportWidth: number,
  offsets: number[],
  taskColWidth = TASK_COL_WIDTH,
): HorizontalWindow {
  const total = offsets.length - 1;
  if (total <= 0) {
    return { start: 0, end: 0, leftPad: 0, rightPad: 0 };
  }

  const dateViewport = Math.max(0, viewportWidth - taskColWidth);
  const firstVisible = findColumnAtOffset(offsets, Math.max(0, scrollLeft));
  const start = findColumnAtOffset(
    offsets,
    Math.max(0, offsets[firstVisible] - dateViewport * 2),
  );
  const end = Math.min(
    total,
    findColumnAtOffset(offsets, offsets[firstVisible] + dateViewport * 3) + 1,
  );

  return {
    start,
    end,
    leftPad: offsets[start],
    rightPad: offsets[total] - offsets[end],
  };
}

export function useHorizontalWindowByOffsets(
  scrollLeft: number,
  viewportWidth: number,
  offsets: number[],
  taskColWidth = TASK_COL_WIDTH,
): HorizontalWindow {
  return useMemo(
    () =>
      computeHorizontalWindowByOffsets(
        scrollLeft,
        viewportWidth,
        offsets,
        taskColWidth,
      ),
    [scrollLeft, viewportWidth, offsets, taskColWidth],
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
