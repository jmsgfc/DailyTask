import {
  PhysicalPosition,
  PhysicalSize,
  currentMonitor,
  getCurrentWindow,
} from "@tauri-apps/api/window";

/** 胶囊态：贴右边的一条；展开态：原挂件尺寸。 */
export const CAPSULE_WIDTH = 44;
export const CAPSULE_HEIGHT = 120;
export const EXPANDED_WIDTH = 220;
export const EXPANDED_HEIGHT = 280;
export const CAPSULE_STORAGE_KEY = "dailytask.widget.collapsed";

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetPlacement {
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * 物理像素计算：贴住工作区右边，纵向沿用当前 y 并夹在工作区内。
 * 收起/展开只改尺寸和 x；y 由调用方传入当前窗口的 y。
 */
export function computeWidgetPlacement(
  workArea: WorkArea,
  scaleFactor: number,
  currentY: number,
  collapsed: boolean,
): WidgetPlacement {
  const width = Math.round(
    (collapsed ? CAPSULE_WIDTH : EXPANDED_WIDTH) * scaleFactor,
  );
  const height = Math.round(
    (collapsed ? CAPSULE_HEIGHT : EXPANDED_HEIGHT) * scaleFactor,
  );
  const x = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;
  const y = Math.min(Math.max(currentY, workArea.y), Math.max(workArea.y, maxY));

  return { width, height, x, y };
}

export function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(CAPSULE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeCollapsedPreference(collapsed: boolean): void {
  try {
    localStorage.setItem(CAPSULE_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // 隐私模式或存储被禁用时忽略，不影响本次会话。
  }
}

/** 把窗口调成胶囊或展开尺寸，并贴到当前显示器右侧。 */
export async function applyWidgetLayout(
  collapsed: boolean,
): Promise<void> {
  const monitor = await currentMonitor();
  if (!monitor) {
    return;
  }

  const window = getCurrentWindow();
  const current = await window.outerPosition();
  const workArea = monitor.workArea;
  const placement = computeWidgetPlacement(
    {
      x: workArea.position.x,
      y: workArea.position.y,
      width: workArea.size.width,
      height: workArea.size.height,
    },
    monitor.scaleFactor,
    current.y,
    collapsed,
  );

  await window.setSize(
    new PhysicalSize(placement.width, placement.height),
  );
  await window.setPosition(new PhysicalPosition(placement.x, placement.y));
}
