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
 * 物理像素计算：以当前窗口右边缘为锚点缩放（向左长/收），
 * 横向和纵向都夹在工作区内；首次贴边时由调用方传入工作区右边缘。
 */
export function computeWidgetPlacement(
  workArea: WorkArea,
  scaleFactor: number,
  rightEdge: number,
  currentY: number,
  collapsed: boolean,
): WidgetPlacement {
  const width = Math.round(
    (collapsed ? CAPSULE_WIDTH : EXPANDED_WIDTH) * scaleFactor,
  );
  const height = Math.round(
    (collapsed ? CAPSULE_HEIGHT : EXPANDED_HEIGHT) * scaleFactor,
  );
  const maxX = workArea.x + workArea.width - width;
  const x = Math.min(
    Math.max(rightEdge - width, workArea.x),
    Math.max(workArea.x, maxX),
  );
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

/** 把窗口调成胶囊或展开尺寸；默认以当前窗口右边缘为锚点。 */
export async function applyWidgetLayout(
  collapsed: boolean,
  dockToEdge = false,
): Promise<void> {
  const monitor = await currentMonitor();
  if (!monitor) {
    return;
  }

  const window = getCurrentWindow();
  const position = await window.outerPosition();
  const size = await window.outerSize();
  const workArea = monitor.workArea;
  const rightEdge = dockToEdge
    ? workArea.position.x + workArea.size.width
    : position.x + size.width;
  const placement = computeWidgetPlacement(
    {
      x: workArea.position.x,
      y: workArea.position.y,
      width: workArea.size.width,
      height: workArea.size.height,
    },
    monitor.scaleFactor,
    rightEdge,
    position.y,
    collapsed,
  );

  await window.setSize(
    new PhysicalSize(placement.width, placement.height),
  );
  await window.setPosition(new PhysicalPosition(placement.x, placement.y));
}
