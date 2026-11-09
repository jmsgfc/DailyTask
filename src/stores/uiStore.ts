import { create } from "zustand";

export type ViewName = "today" | "grid" | "todos" | "manage" | "stats" | "settings";

/** 主窗销毁重建后要回到上次页面，所以 view 落 localStorage。 */
export const VIEW_STORAGE_KEY = "dailytask.ui.view";

const VIEWS: ViewName[] = [
  "today",
  "grid",
  "todos",
  "manage",
  "stats",
  "settings",
];

function readView(): ViewName {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return VIEWS.includes(stored as ViewName) ? (stored as ViewName) : "today";
  } catch {
    return "today";
  }
}

function writeView(view: ViewName): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // 存储被禁用时忽略，本次会话仍可切换。
  }
}

export interface GridFilter {
  category: "all" | "voluntary" | "forced";
  taskId: string | null;
  from: string | null;
  to: string | null;
}

export interface UiState {
  view: ViewName;
  gridFilter: GridFilter;
  selectedCell: { taskId: string; date: string } | null;
  widgetExpanded: boolean;
  setView: (view: ViewName) => void;
  setGridFilter: (filter: Partial<GridFilter>) => void;
  selectCell: (cell: { taskId: string; date: string } | null) => void;
  setWidgetExpanded: (expanded: boolean) => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  view: readView(),
  gridFilter: { category: "all", taskId: null, from: null, to: null },
  selectedCell: null,
  widgetExpanded: false,

  setView: (view) => {
    writeView(view);
    set({ view });
  },
  setGridFilter: (filter) =>
    set({ gridFilter: { ...get().gridFilter, ...filter } }),
  selectCell: (selectedCell) => set({ selectedCell }),
  setWidgetExpanded: (widgetExpanded) => set({ widgetExpanded }),
}));
