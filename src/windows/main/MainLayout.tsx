import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import type { MessageKey } from "../../shared/i18n";
import { useUiStore, type ViewName } from "../../stores/uiStore";
import { useUpdateStore } from "../../stores/updateStore";
import { Icon, type IconName } from "../../ui/Icon";
import { useT } from "../../ui/useT";
import {
  moveNavItem,
  readNavOrder,
  writeNavOrder,
} from "./navOrder";
import Manage from "./views/Manage";
import Settings from "./views/Settings";
import Stats from "./views/Stats";
import TaskGrid from "./views/TaskGrid";
import Today from "./views/Today";
import Todos from "./views/Todos";

const NAV_BY_VIEW: Record<
  ViewName,
  { labelKey: MessageKey; icon: IconName }
> = {
  today: { labelKey: "nav.today", icon: "today" },
  grid: { labelKey: "nav.grid", icon: "grid" },
  todos: { labelKey: "nav.todos", icon: "todo" },
  manage: { labelKey: "nav.manage", icon: "manage" },
  stats: { labelKey: "nav.stats", icon: "stats" },
  settings: { labelKey: "nav.settings", icon: "settings" },
};

function renderView(view: ViewName) {
  switch (view) {
    case "today":
      return <Today />;
    case "grid":
      return <TaskGrid />;
    case "todos":
      return <Todos />;
    case "manage":
      return <Manage />;
    case "stats":
      return <Stats />;
    case "settings":
      return <Settings />;
  }
}

export function MainLayout() {
  const t = useT();
  const currentView = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);
  const hasUpdate = useUpdateStore((state) => state.available !== null);
  const [order, setOrder] = useState<ViewName[]>(readNavOrder);
  const [dragging, setDragging] = useState<ViewName | null>(null);
  const [gap, setGap] = useState<number | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{
    view: ViewName;
    startY: number;
    active: boolean;
  } | null>(null);
  const gapRef = useRef<number | null>(null);
  const suppressClick = useRef(false);

  const applyOrder = (next: ViewName[]) => {
    setOrder(next);
    writeNavOrder(next);
  };

  const updateGap = (next: number | null) => {
    gapRef.current = next;
    setGap(next);
  };

  const beginDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    view: ViewName,
  ) => {
    if (event.button > 0) {
      return;
    }
    dragRef.current = { view, startY: event.clientY, active: false };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    if (!drag.active) {
      if (Math.abs(event.clientY - drag.startY) < 4) {
        return;
      }
      drag.active = true;
      suppressClick.current = true;
      setDragging(drag.view);
    }
    const nav = navRef.current;
    if (!nav) {
      return;
    }
    const rect = nav.getBoundingClientRect();
    const step = rect.height / order.length;
    const raw = Math.round((event.clientY - rect.top) / step);
    updateGap(Math.max(0, Math.min(order.length, raw)));
  };

  const endDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    const targetGap = gapRef.current;
    if (drag?.active && targetGap !== null) {
      const from = order.indexOf(drag.view);
      const to = from < targetGap ? targetGap - 1 : targetGap;
      if (to !== from) {
        applyOrder(moveNavItem(order, from, to));
      }
    }
    setDragging(null);
    updateGap(null);
  };

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    view: ViewName,
  ) => {
    if (!event.altKey) {
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }
    event.preventDefault();
    const from = order.indexOf(view);
    const to = from + (event.key === "ArrowUp" ? -1 : 1);
    if (to < 0 || to >= order.length) {
      return;
    }
    applyOrder(moveNavItem(order, from, to));
  };

  return (
    <div className="flex h-full bg-[var(--color-bg)] text-[var(--color-text)]">
      <aside className="flex w-[var(--nav-width)] shrink-0 flex-col gap-0.5 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-3">
        <nav
          ref={navRef}
          aria-label="主导航"
          className="flex flex-col gap-0.5"
        >
          {order.map((view, index) => {
            const item = NAV_BY_VIEW[view];
            const active = view === currentView;
            const draggingThis = dragging === view;
            return (
              <div key={view} className="relative">
                {gap === index ? <DropLine position="top" /> : null}
                {index === order.length - 1 && gap === order.length ? (
                  <DropLine position="bottom" />
                ) : null}
                <button
                  type="button"
                  data-nav-item={view}
                  data-dragging={draggingThis ? "" : undefined}
                  title={t("nav.dragHint")}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }
                    setView(view);
                  }}
                  onPointerDown={(event) => beginDrag(event, view)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onLostPointerCapture={endDrag}
                  onKeyDown={(event) => handleKeyDown(event, view)}
                  className={`${
                    active
                      ? "bg-[var(--state-selected)] font-semibold text-[var(--color-voluntary)]"
                      : "text-[var(--color-text-muted)] hover:bg-[var(--state-hover)]"
                  } flex h-9 w-full touch-none cursor-grab items-center gap-2 rounded-[var(--radius-control)] px-2 text-left active:cursor-grabbing ${
                    draggingThis ? "opacity-50" : ""
                  }`}
                >
                  <Icon name={item.icon} />
                  {t(item.labelKey)}
                  {view === "settings" && hasUpdate ? (
                    <span
                      data-update-dot
                      aria-label={t("update.dot")}
                      className="ml-auto size-1.5 shrink-0 rounded-full bg-[var(--color-missed)]"
                    />
                  ) : null}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto px-2 py-2 text-[var(--text-2xs)] text-[var(--color-text-muted)]">
          {t("app.footer", { version: __APP_VERSION__ })}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        {renderView(currentView)}
      </section>
    </div>
  );
}

/** 拖拽时的插入位置指示线，绝对定位于相邻两项之间，不改变布局。 */
function DropLine({ position }: { position: "top" | "bottom" }) {
  return (
    <span
      aria-hidden="true"
      data-nav-gap={position}
      className={`pointer-events-none absolute inset-x-1 z-10 h-[2px] rounded-full bg-[var(--color-voluntary)] ${
        position === "top" ? "-top-px" : "-bottom-px"
      }`}
    />
  );
}
