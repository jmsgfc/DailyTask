import { PhysicalPosition, getCurrentWindow } from "@tauri-apps/api/window";
import { format, parseISO } from "date-fns";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import type { CellState } from "../../domain/types";
import { emitWidgetExpand } from "../../shared/events";
import { useCheckinsStore } from "../../stores/checkinsStore";
import {
  useTodayData,
  type CategoryStat,
  type DueTodoItem,
  type TodayTask,
} from "../../stores/selectors/today";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTodosStore } from "../../stores/todosStore";
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

/**
 * 展开态与「今日」页内容一致：日期、完成率、自愿/被迫分项、全部任务、全部到期待办。
 * 标题与进度固定，中间内容滚动；高度预算见 impl.md §5（内容区 240px）。
 */
export function Widget() {
  const t = useT();
  const data = useTodayData();
  const setStatus = useCheckinsStore((state) => state.setStatus);
  const setTodoDone = useTodosStore((state) => state.setDone);
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
  const completed = data.progress.done;
  const total =
    data.progress.applicable - data.progress.skipped - data.progress.recorded;
  const percent = Math.round(data.progress.ratio * 100);
  const statusText =
    total === 0
      ? t("today.noTasks")
      : data.progress.pending > 0
        ? t("today.remaining", { count: data.progress.pending })
        : t("today.allDone");
  const dueTodos = [...data.overdueTodos, ...data.todayTodos];
  const ratio = total === 0 ? 0 : completed / total;

  const complete = (row: TodayTask) => {
    void setStatus(row.task.id, data.today, "done");
  };

  const completeTodo = (item: DueTodoItem) => {
    void setTodoDone(item.todo.id, true);
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
      <section className="group relative flex h-full select-none flex-col overflow-hidden rounded-[var(--radius-widget)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[var(--color-text)] shadow-[var(--shadow-widget)]">
        <div className="relative z-[1] flex h-full flex-col">
          <header className="relative flex h-[22px] shrink-0 items-center">
            <div
              data-tauri-drag-region
              className="flex h-full min-w-0 flex-1 items-center pr-1"
            >
              <span className="truncate text-[12.5px] font-semibold">
                {t("today.title")} · {data.dateLabel}
              </span>
            </div>
            <div className="pointer-events-none absolute right-0 top-0 flex h-[22px] items-center gap-px bg-[var(--color-surface)] pl-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
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

          <div className="my-1 flex h-[50px] shrink-0 items-center gap-3">
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
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5">
                <b className="text-[13px] tabular-nums">
                  {completed} / {total}
                </b>
                <span className="text-[10px] tabular-nums text-[var(--color-text-muted)]">
                  {percent}%
                </span>
                <span className="truncate text-[10px] text-[var(--color-text-muted)]">
                  · {statusText}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                <CategoryCount
                  label={t("today.category.voluntary")}
                  color="var(--color-voluntary)"
                  stat={data.voluntaryStat}
                />
                <CategoryCount
                  label={t("today.category.forced")}
                  color="var(--color-forced)"
                  stat={data.forcedStat}
                />
              </div>
            </div>
          </div>

          <div
            data-widget-scroll
            className="widget-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5"
          >
            {rows.length === 0 ? (
              <p className="m-0 py-2 text-center text-[11px] text-[var(--color-text-muted)]">
                {t("today.empty")}
              </p>
            ) : (
              <>
                <WidgetTaskGroup
                  title={t("today.group.voluntary")}
                  color="var(--color-voluntary)"
                  rows={data.voluntary}
                  stat={data.voluntaryStat}
                  onComplete={complete}
                />
                <WidgetTaskGroup
                  title={t("today.group.forced")}
                  color="var(--color-forced)"
                  rows={data.forced}
                  stat={data.forcedStat}
                  onComplete={complete}
                />
              </>
            )}

            {dueTodos.length > 0 ? (
              <div className={rows.length > 0 ? "mt-1" : ""}>
                <div className="flex h-5 items-center gap-1.5 px-1 text-[10.5px] font-semibold text-[var(--color-text-muted)]">
                  <span className="truncate">{t("today.dueTodos")}</span>
                  <span className="ml-auto shrink-0 font-normal tabular-nums">
                    {t("common.itemCount", { count: dueTodos.length })}
                  </span>
                </div>
                {dueTodos.map((item) => (
                  <WidgetTodoRow
                    key={item.todo.id}
                    item={item}
                    onComplete={() => completeTodo(item)}
                  />
                ))}
              </div>
            ) : null}
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

const ROW_SYMBOLS: Record<CellState, string> = {
  done: "✓",
  missed: "✗",
  skipped: "–",
  recorded: "•",
  pending: "",
  none: "",
};

const ROW_ICON: Record<CellState, string> = {
  done: "border-[var(--color-voluntary)] bg-[var(--color-voluntary)] text-white",
  missed:
    "border-[var(--color-missed)] text-[var(--color-missed)]",
  skipped:
    "border-dashed border-[var(--color-border-strong)] bg-[var(--color-na)] text-[var(--color-text-muted)]",
  recorded:
    "border-[var(--color-border-strong)] text-[var(--color-text-muted)]",
  pending: "border-[var(--color-border-strong)] text-transparent",
  none: "border-[var(--color-border-strong)] text-transparent",
};

function CategoryCount({
  label,
  color,
  stat,
}: {
  label: string;
  color: string;
  stat: CategoryStat;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1 tabular-nums">
      <i className="size-2 rounded-full" style={{ background: color }} />
      {label} {stat.done} / {stat.total}
    </span>
  );
}

function WidgetTaskGroup({
  title,
  color,
  rows,
  stat,
  onComplete,
}: {
  title: string;
  color: string;
  rows: TodayTask[];
  stat: CategoryStat;
  onComplete: (row: TodayTask) => void;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex h-5 items-center gap-1.5 px-1 text-[10.5px] font-semibold text-[var(--color-text-muted)]">
        <i
          aria-hidden="true"
          className="h-3 w-[3px] shrink-0 rounded-[2px]"
          style={{ background: color }}
        />
        <span className="truncate">{title}</span>
        <span className="ml-auto shrink-0 font-normal tabular-nums">
          {stat.done} / {stat.total}
        </span>
      </div>
      {rows.map((row) => (
        <WidgetTaskRow
          key={row.task.id}
          row={row}
          onComplete={() => onComplete(row)}
        />
      ))}
    </div>
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
  const interactive = row.state === "pending" || row.state === "missed";
  const nameClass =
    row.state === "skipped"
      ? "min-w-0 flex-1 truncate text-[var(--color-text-muted)] line-through"
      : row.state === "done"
        ? "min-w-0 flex-1 truncate text-[var(--color-text-muted)]"
        : "min-w-0 flex-1 truncate";

  const content = (
    <>
      <span
        aria-hidden="true"
        className={`grid size-[17px] shrink-0 place-items-center rounded-[4px] border-[1.4px] text-[10px] font-bold leading-none ${ROW_ICON[row.state]}`}
      >
        {ROW_SYMBOLS[row.state]}
      </span>
      <span className={nameClass}>{row.task.name}</span>
      {row.value ? (
        <span className="max-w-[45%] shrink-0 truncate rounded-[var(--radius-pill)] bg-[var(--state-hover)] px-1 text-[10px] tabular-nums text-[var(--color-text-muted)]">
          {row.value}
        </span>
      ) : null}
    </>
  );

  const base =
    "flex h-[26px] w-full items-center gap-[6px] rounded-[5px] px-1 text-left text-[12px]";

  if (!interactive) {
    return (
      <div data-state={row.state} className={base}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-state={row.state}
      aria-label={t("widget.complete", { task: row.task.name })}
      onClick={onComplete}
      className={`${base} hover:bg-[var(--state-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]`}
    >
      {content}
    </button>
  );
}

function WidgetTodoRow({
  item,
  onComplete,
}: {
  item: DueTodoItem;
  onComplete: () => void;
}) {
  const t = useT();
  const { todo, overdueDays } = item;
  const overdue = overdueDays > 0;

  return (
    <button
      type="button"
      aria-label={t("todos.markDone", { title: todo.title })}
      onClick={onComplete}
      className="flex h-[26px] w-full items-center gap-1.5 rounded-[5px] px-1 text-left text-[11.5px] hover:bg-[var(--state-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
    >
      <span
        aria-hidden="true"
        className="size-3 shrink-0 rounded-full border-[1.4px] border-[var(--color-border-strong)]"
      />
      <span className="min-w-0 flex-1 truncate">{todo.title}</span>
      <span className="shrink-0 text-[9.5px] tabular-nums text-[var(--color-text-muted)]">
        {format(parseISO(todo.dueDate as string), "MM/dd")}
      </span>
      <span
        className={
          overdue
            ? "shrink-0 text-[9.5px] font-semibold text-[var(--color-missed)]"
            : "shrink-0 text-[9.5px] font-semibold text-[var(--color-warning)]"
        }
      >
        {overdue
          ? t("today.overdueDays", { days: overdueDays })
          : t("today.dueToday")}
      </span>
    </button>
  );
}
