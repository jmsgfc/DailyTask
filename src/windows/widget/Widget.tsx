import { PhysicalPosition, getCurrentWindow } from "@tauri-apps/api/window";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { emitWidgetExpand } from "../../shared/events";
import { useCheckinsStore } from "../../stores/checkinsStore";
import {
  useTodayData,
  type DueTodoItem,
  type TodayTask,
} from "../../stores/selectors/today";
import { useSettingsStore } from "../../stores/settingsStore";
import { applyTheme } from "../../ui/theme";
import { useT } from "../../ui/useT";
import {
  applyWidgetLayout,
  readCollapsedPreference,
  readSidePreference,
  writeCollapsedPreference,
  writeSidePreference,
  type WidgetSide,
} from "./capsule";

const RING_RADIUS = 17;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const MAX_TASKS = 4;
const MAX_TODOS = 2;

/**
 * 挂件只渲染：日期、进度、未完成项、已完成折叠行、今日到期待办。
 * 高度预算见 impl.md §5：内容区 240px，任务最多 4 条、待办最多 2 条。
 */
export function Widget() {
  const t = useT();
  const data = useTodayData();
  const setStatus = useCheckinsStore((state) => state.setStatus);
  const alwaysOnTop = useSettingsStore((state) => state.settings.alwaysOnTop);
  const theme = useSettingsStore((state) => state.settings.theme);
  const updateSettings = useSettingsStore((state) => state.update);
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const [side, setSide] = useState<WidgetSide>(readSidePreference);
  const initialCollapsed = useRef(collapsed);
  const initialSide = useRef(side);

  useEffect(() => {
    void getCurrentWindow().setAlwaysOnTop(alwaysOnTop).catch((error: unknown) => {
      console.error("[widget] 更新置顶状态失败", error);
    });
  }, [alwaysOnTop]);

  // 主窗切换主题后，挂件通过 settings:changed 重读设置并重放主题。
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // 启动时如果上次是胶囊态，直接贴到记住的一侧。
  useEffect(() => {
    if (initialCollapsed.current) {
      void applyWidgetLayout(true, initialSide.current).catch(
        (error: unknown) => {
          console.error("[widget] 恢复胶囊态失败", error);
        },
      );
    }
  }, []);

  const setCapsule = (next: boolean) => {
    writeCollapsedPreference(next);
    setCollapsed(next);
    void applyWidgetLayout(next, next ? undefined : side)
      .then((used) => {
        if (used) {
          writeSidePreference(used);
          setSide(used);
        }
      })
      .catch((error: unknown) => {
        console.error("[widget] 调整挂件尺寸失败", error);
      });
  };

  /** 拖动结束后吸附到最近的左/右边缘。 */
  const snapCapsule = () => {
    void applyWidgetLayout(true)
      .then((used) => {
        if (used) {
          writeSidePreference(used);
          setSide(used);
        }
      })
      .catch((error: unknown) => {
        console.error("[widget] 吸附胶囊失败", error);
      });
  };

  const togglePin = () => {
    void updateSettings({ alwaysOnTop: !alwaysOnTop }).catch(
      (error: unknown) => {
        console.error("[widget] 保存置顶设置失败", error);
      },
    );
  };

  const minimize = () => {
    void getCurrentWindow().hide().catch((error: unknown) => {
      console.error("[widget] 最小化挂件失败", error);
    });
  };

  const rows = [...data.voluntary, ...data.forced];
  const incomplete = rows.filter(
    (row) =>
      row.state !== "done" &&
      row.state !== "skipped" &&
      row.state !== "recorded",
  );
  const completed = data.progress.done;
  const total =
    data.progress.applicable - data.progress.skipped - data.progress.recorded;
  const remaining = Math.max(total - completed, 0);
  const visibleTasks = incomplete.slice(0, MAX_TASKS);
  const hiddenTasks = incomplete.length - visibleTasks.length;

  const dueTodos = [...data.overdueTodos, ...data.todayTodos];
  const visibleTodos = dueTodos.slice(0, MAX_TODOS);
  const hiddenTodos = dueTodos.length - visibleTodos.length;
  const ratio = total === 0 ? 0 : completed / total;

  const complete = (row: TodayTask) => {
    void setStatus(row.task.id, data.today, "done");
  };

  if (collapsed) {
    return (
      <WidgetCapsule
        done={completed}
        total={total}
        side={side}
        label={t("widget.expandCapsule", { done: completed, total })}
        hint={t("widget.capsuleHint")}
        onExpand={() => setCapsule(false)}
        onDragEnd={snapCapsule}
      />
    );
  }

  return (
    <div className="h-full w-full p-2">
      <section className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-widget)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[var(--color-text)] shadow-[var(--shadow-widget)]">
        <div className="relative z-[1] flex h-full flex-col">
          <header className="flex h-5 shrink-0 items-center gap-1">
            <div
              data-tauri-drag-region
              className="flex h-full min-w-0 flex-1 items-center"
            >
              <span className="truncate text-[13px] font-semibold">
                {data.dateLabel}
              </span>
            </div>
            <div className="flex shrink-0 gap-px opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <WidgetAction
                label={t("widget.expand")}
                onClick={() =>
                  void emitWidgetExpand({ source: "widget" })
                    .then(() => setCapsule(true))
                    .catch((error: unknown) => {
                      console.error("[widget] 展开主窗口失败", error);
                    })
                }
              >
                <path d="M6.5 2.5h-4v4M9.5 13.5h4v-4M2.5 2.5l4.5 4.5M13.5 13.5L9 9" />
              </WidgetAction>
              <WidgetAction
                label={t(alwaysOnTop ? "widget.unpin" : "widget.pin")}
                active={alwaysOnTop}
                onClick={togglePin}
              >
                <path d="M8 1.8v4.4M4.8 6.2h6.4L10 10H6L4.8 6.2zM8 10.2v4" />
              </WidgetAction>
              <WidgetAction
                label={t("widget.collapse")}
                onClick={() => setCapsule(true)}
              >
                <path d="M6 3.5L10.5 8 6 12.5" />
              </WidgetAction>
              <WidgetAction label={t("widget.minimize")} onClick={minimize}>
                <path d="M3.5 8h9" />
              </WidgetAction>
            </div>
          </header>

          <div className="my-1 flex h-11 shrink-0 items-center gap-2.5">
            <div
              role="img"
              aria-label={t("progress.aria", { done: completed, total })}
              className="relative size-10 shrink-0"
            >
              <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
                <circle
                  cx="20"
                  cy="20"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="color-mix(in srgb, var(--color-text) 12%, transparent)"
                  strokeWidth="4"
                />
                <circle
                  cx="20"
                  cy="20"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="var(--color-voluntary)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={RING_CIRCUMFERENCE * (1 - ratio)}
                  transform="rotate(-90 20 20)"
                  style={{
                    transition:
                      "stroke-dashoffset .3s cubic-bezier(.4, 0, .2, 1)",
                  }}
                />
              </svg>
            </div>
            <div className="flex min-w-0 flex-col gap-px">
              <b className="text-[13px] tabular-nums">
                {completed} / {total}
              </b>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {remaining > 0
                  ? t("widget.remaining", { count: remaining })
                  : t("widget.allDone")}
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            {visibleTasks.length === 0 ? (
              <p className="m-0 py-2 text-center text-[11px] text-[var(--color-text-muted)]">
                {t("widget.empty")}
              </p>
            ) : (
              visibleTasks.map((row) => (
                <WidgetTaskRow
                  key={row.task.id}
                  row={row}
                  onComplete={() => complete(row)}
                />
              ))
            )}
          </div>

          <div className="mt-0.5 flex h-4 shrink-0 items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
            <span className="font-bold text-[var(--color-voluntary)]">✓</span>
            <span>{t("widget.completedCount", { count: completed })}</span>
            {hiddenTasks > 0 ? (
              <span className="ml-auto">
                {t("widget.moreTasks", { count: hiddenTasks })}
              </span>
            ) : hiddenTodos > 0 ? (
              <span className="ml-auto">+{hiddenTodos}</span>
            ) : null}
          </div>

          <div className="mt-1 shrink-0">
            {visibleTodos.map((item) => (
              <WidgetTodoRow key={item.todo.id} item={item} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function WidgetCapsule({
  done,
  total,
  side,
  label,
  hint,
  onExpand,
  onDragEnd,
}: {
  done: number;
  total: number;
  side: WidgetSide;
  label: string;
  hint: string;
  onExpand: () => void;
  onDragEnd: () => void;
}) {
  const t = useT();
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const startWindow = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const suppressClick = useRef(false);

  const handlePointerDown = (event: ReactPointerEvent) => {
    if (event.button > 0) {
      return;
    }
    dragStart.current = {
      x: event.screenX || event.clientX,
      y: event.screenY || event.clientY,
    };
    startWindow.current = null;
    dragged.current = false;
    suppressClick.current = false;
    // 捕获指针，保证移动超出胶囊范围后仍能收到 pointermove。
    event.currentTarget.setPointerCapture?.(event.pointerId);
    void getCurrentWindow()
      .outerPosition()
      .then((position) => {
        startWindow.current = { x: position.x, y: position.y };
      })
      .catch((error: unknown) => {
        console.error("[widget] 读取挂件位置失败", error);
      });
  };

  const handlePointerMove = (event: ReactPointerEvent) => {
    const start = dragStart.current;
    const origin = startWindow.current;
    if (!start || !origin) {
      return;
    }
    const dx = (event.screenX || event.clientX) - start.x;
    const dy = (event.screenY || event.clientY) - start.y;
    if (!dragged.current && Math.hypot(dx, dy) < 4) {
      return;
    }
    dragged.current = true;
    suppressClick.current = true;
    const scale = window.devicePixelRatio || 1;
    void getCurrentWindow()
      .setPosition(
        new PhysicalPosition(
          Math.round(origin.x + dx * scale),
          Math.round(origin.y + dy * scale),
        ),
      )
      .catch((error: unknown) => {
        console.error("[widget] 拖动挂件失败", error);
      });
  };

  const handlePointerUp = () => {
    dragStart.current = null;
    startWindow.current = null;
    if (dragged.current) {
      dragged.current = false;
      onDragEnd();
    }
  };

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onExpand();
  };

  const rounded =
    side === "right"
      ? "rounded-l-[var(--radius-pill)]"
      : "rounded-r-[var(--radius-pill)]";

  return (
    <div className="h-full w-full p-1">
      <button
        type="button"
        data-widget-capsule
        data-widget-side={side}
        aria-label={label}
        title={hint}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        className={`flex h-full w-full items-center justify-center gap-1.5 border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[var(--color-text)] shadow-[var(--shadow-widget)] transition-colors hover:border-[var(--color-voluntary)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ${rounded}`}
      >
        <span
          aria-hidden="true"
          className="text-[10px] leading-none text-[var(--color-text-muted)]"
        >
          {side === "right" ? "‹" : "›"}
        </span>
        <span className="text-[11px] leading-none">
          {t("widget.capsuleExpand")}
        </span>
        <b className="text-[10px] leading-none tabular-nums text-[var(--color-text-muted)]">
          {done}/{total}
        </b>
      </button>
    </div>
  );
}

function WidgetAction({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "grid size-[18px] place-items-center rounded-[4px] bg-[var(--state-active)] text-[var(--color-text)] hover:bg-[var(--state-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          : "grid size-[18px] place-items-center rounded-[4px] text-[color-mix(in_srgb,var(--color-text)_55%,transparent)] hover:bg-[var(--state-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
      }
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}

function WidgetTaskRow({
  row,
  onComplete,
}: {
  row: TodayTask;
  onComplete: () => void;
}) {
  const t = useT();
  const missed = row.state === "missed";

  return (
    <button
      type="button"
      data-state={row.state}
      aria-label={t("widget.complete", { task: row.task.name })}
      onClick={onComplete}
      className="-mx-1 flex h-6 w-[calc(100%+8px)] items-center gap-[7px] rounded-[5px] px-1 text-left hover:bg-[var(--state-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
    >
      <span
        aria-hidden="true"
        className={
          missed
            ? "grid size-4 shrink-0 place-items-center rounded-[4px] border-[1.4px] border-[var(--color-missed)] text-[10px] font-bold text-[var(--color-missed)]"
            : "grid size-4 shrink-0 place-items-center rounded-[4px] border-[1.4px] border-[var(--color-border-strong)] text-[10px] font-bold text-transparent"
        }
      >
        {missed ? "✗" : "✓"}
      </span>
      <span className="min-w-0 truncate text-[11.5px]">{row.task.name}</span>
    </button>
  );
}

function WidgetTodoRow({ item }: { item: DueTodoItem }) {
  const t = useT();
  const { todo, overdueDays } = item;
  const overdue = overdueDays > 0;

  return (
    <div className="-mx-1 flex h-6 items-center gap-1.5 rounded-[5px] px-1 text-[11px] hover:bg-[var(--state-hover)]">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full border-[1.3px] border-[var(--color-border-strong)]"
      />
      <span className="min-w-0 truncate">{todo.title}</span>
      <span
        className={
          overdue
            ? "ml-auto shrink-0 text-[9.5px] font-semibold text-[var(--color-missed)]"
            : "ml-auto shrink-0 text-[9.5px] font-semibold text-[var(--color-warning)]"
        }
      >
        {overdue
          ? t("today.overdueDays", { days: overdueDays })
          : t("today.dueToday")}
      </span>
    </div>
  );
}
