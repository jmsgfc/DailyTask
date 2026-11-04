import { clsx } from "clsx";
import { format, parseISO } from "date-fns";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import type { GridRow } from "../../../domain/grid";
import { monthTicks } from "../../../domain/grid";
import { checkinKey } from "../../../domain/keys";
import { nextCellState, type CellState } from "../../../domain/settle";
import type { Checkin, Language } from "../../../domain/types";
import type { MessageKey } from "../../../shared/i18n";
import { dateLocale } from "../../../shared/i18n";
import { useCheckinsStore } from "../../../stores/checkinsStore";
import { useGridData } from "../../../stores/selectors/grid";
import { useSettingsStore } from "../../../stores/settingsStore";
import { useTasksStore } from "../../../stores/tasksStore";
import { useUiStore } from "../../../stores/uiStore";
import {
  CELL_LABEL_KEYS,
  CELL_SYMBOLS,
} from "../../../ui/CheckCell";
import {
  scrollLeftForToday,
  TASK_COL_WIDTH,
  useHorizontalWindow,
} from "../../../ui/useHorizontalWindow";
import { useT } from "../../../ui/useT";

const MONTH_ROW_HEIGHT = 22;
const DATE_ROW_HEIGHT = 34;
const GROUP_ROW_HEIGHT = 26;
const TASK_ROW_HEIGHT = 34;
const MIN_ZOOM = 14;
const MAX_ZOOM = 44;
const ZOOM_STEP = 2;

type GroupKey = "voluntary" | "forced" | "disabled";

const GROUP_META: Record<
  GroupKey,
  { labelKey: MessageKey; color: string }
> = {
  voluntary: {
    labelKey: "grid.group.voluntary",
    color: "var(--color-voluntary)",
  },
  forced: { labelKey: "grid.group.forced", color: "var(--color-forced)" },
  disabled: {
    labelKey: "grid.group.disabled",
    color: "var(--color-border-strong)",
  },
};

export default function TaskGrid() {
  const t = useT();
  const data = useGridData();
  const setStatus = useCheckinsStore((state) => state.setStatus);
  const setNote = useCheckinsStore((state) => state.setNote);
  const reorder = useTasksStore((state) => state.reorder);
  const filter = useUiStore((state) => state.gridFilter);
  const setGridFilter = useUiStore((state) => state.setGridFilter);

  const cellSize = Math.min(44, Math.max(14, data.settings.gridZoom));
  const overview = cellSize < 24;
  const rowHeight = overview ? 18 : TASK_ROW_HEIGHT;
  const groupHeight = overview ? 18 : GROUP_ROW_HEIGHT;
  const from =
    filter.from && filter.to && filter.from > filter.to
      ? filter.to
      : filter.from;
  const to =
    filter.from && filter.to && filter.from > filter.to
      ? filter.from
      : filter.to;
  const dates = data.axis.dates.filter(
    (date) => (!from || date >= from) && (!to || date <= to),
  );
  const todayIndex = dates.indexOf(data.today);
  const filterActive =
    filter.category !== "all" ||
    filter.taskId !== null ||
    filter.from !== null ||
    filter.to !== null;
  const totalWidth = TASK_COL_WIDTH + dates.length * cellSize;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(() =>
    scrollLeftForToday(Math.max(0, todayIndex), 832, cellSize),
  );
  const effectiveWidth = viewportWidth || 832;
  const viewRef = useRef({ scrollLeft, cellSize, width: effectiveWidth });
  viewRef.current = { scrollLeft, cellSize, width: effectiveWidth };

  const viewportWindow = useHorizontalWindow(
    scrollLeft,
    effectiveWidth,
    dates.length,
    cellSize,
  );
  const visibleDates = dates.slice(viewportWindow.start, viewportWindow.end);

  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>({
    voluntary: false,
    forced: false,
    disabled: true,
  });
  const [focused, setFocused] = useState<{
    taskId: string;
    date: string;
  } | null>(null);
  const pendingFocus = useRef(false);
  const cardRef = useRef<HTMLElement>(null);
  const [noteTarget, setNoteTarget] = useState<{
    taskId: string;
    date: string;
    taskName: string;
    left: number;
    top: number;
  } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const jumpToToday = useCallback(() => {
    const element = scrollerRef.current;
    const width = element?.clientWidth || effectiveWidth;
    const target =
      todayIndex < 0
        ? 0
        : scrollLeftForToday(todayIndex, width, cellSize);
    if (element) {
      element.scrollLeft = target;
    }
    setScrollLeft(target);
  }, [cellSize, effectiveWidth, todayIndex]);

  useLayoutEffect(() => {
    const element = scrollerRef.current;
    if (!element) {
      return;
    }
    const measure = () => setViewportWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 打开即定位到今天，右侧留 4 天。
  useLayoutEffect(() => {
    jumpToToday();
  }, []);

  // 时间段筛选变化后：今天在范围内就回今天，否则回到范围开头。
  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) {
      return;
    }
    const width = element.clientWidth || effectiveWidth;
    const target =
      todayIndex < 0
        ? 0
        : scrollLeftForToday(todayIndex, width, cellSize);
    element.scrollLeft = target;
    setScrollLeft(target);
  }, [from, to]);

  // 列数变化（筛选）后把 scrollLeft 夹回合法范围。
  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) {
      return;
    }
    const max = Math.max(
      0,
      dates.length * cellSize + TASK_COL_WIDTH - effectiveWidth,
    );
    if (element.scrollLeft > max) {
      element.scrollLeft = max;
      setScrollLeft(max);
    }
  }, [dates.length, cellSize, effectiveWidth]);

  // Ctrl + 滚轮缩放：以可视区中心为锚点，值写回 settings。
  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || event.deltaY === 0) {
        return;
      }
      event.preventDefault();

      const current = Math.min(
        MAX_ZOOM,
        Math.max(
          MIN_ZOOM,
          useSettingsStore.getState().settings.gridZoom,
        ),
      );
      const next = Math.min(
        MAX_ZOOM,
        Math.max(
          MIN_ZOOM,
          current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP),
        ),
      );
      if (next === current) {
        return;
      }

      const view = viewRef.current;
      const dateViewport = Math.max(0, view.width - TASK_COL_WIDTH);
      const centerIndex =
        (view.scrollLeft + dateViewport / 2) / view.cellSize;
      const target = Math.max(0, centerIndex * next - dateViewport / 2);

      element.scrollLeft = target;
      setScrollLeft(target);
      void useSettingsStore.getState().update({ gridZoom: next });
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  /** 键盘移动后把目标日期保持在视口内（左右各留 2 列）。 */
  const ensureDateVisible = (index: number) => {
    const element = scrollerRef.current;
    if (!element) {
      return;
    }
    const width = element.clientWidth || effectiveWidth;
    const dateViewport = Math.max(0, width - TASK_COL_WIDTH);
    const left = index * cellSize;
    const right = left + cellSize;
    let next = element.scrollLeft;

    if (left < next + cellSize * 2) {
      next = Math.max(0, left - cellSize * 2);
    } else if (right > next + dateViewport - cellSize * 2) {
      next = Math.max(0, right - dateViewport + cellSize * 2);
    }

    if (next !== element.scrollLeft) {
      element.scrollLeft = next;
      setScrollLeft(next);
    }
  };

  const handleScroll = () => {
    const element = scrollerRef.current;
    if (element) {
      setScrollLeft(element.scrollLeft);
    }
    if (noteTarget) {
      setNoteTarget(null);
    }
  };

  const baseGroups: { key: GroupKey; rows: GridRow[] }[] = [
    { key: "voluntary", rows: data.groups.voluntary },
    { key: "forced", rows: data.groups.forced },
    { key: "disabled", rows: data.groups.disabled },
  ];
  const allGroups = baseGroups.map((group) => ({
    ...group,
    rows: group.rows.filter(
      (row) =>
        (filter.category === "all" ||
          row.task.category === filter.category) &&
        (filter.taskId === null || row.task.id === filter.taskId),
    ),
  }));
  const groups = allGroups.filter((group) => group.rows.length > 0);

  const handleReorder = (
    groupKey: GroupKey,
    fromId: string,
    toId: string,
  ) => {
    const group = groups.find((item) => item.key === groupKey);
    if (!group) {
      return;
    }
    const ids = group.rows.map((row) => row.task.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0 || from === to) {
      return;
    }
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);

    // 组内顺序改完后，按「自愿 → 被迫 → 已停用」的展示顺序展开成全局顺序。
    const allIds = groups.flatMap((item) =>
      item.key === groupKey ? ids : item.rows.map((row) => row.task.id),
    );
    void reorder(allIds);
  };

  const allRows = groups.flatMap((group) => group.rows);
  const visibleRows = groups
    .filter((group) => !collapsed[group.key])
    .flatMap((group) => group.rows);
  const defaultFocus =
    visibleRows.length > 0
      ? { taskId: visibleRows[0].task.id, date: data.today }
      : null;
  const clampIndex = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const moveFocus = (dateDelta: number, rowDelta: number) => {
    if (visibleRows.length === 0) {
      return;
    }
    const current = focused ?? defaultFocus;
    if (!current) {
      return;
    }
    const dateIndex = clampIndex(
      dates.indexOf(current.date) + dateDelta,
      0,
      dates.length - 1,
    );
    const rowIndex = clampIndex(
      visibleRows.findIndex((row) => row.task.id === current.taskId) +
        rowDelta,
      0,
      visibleRows.length - 1,
    );
    setFocused({
      taskId: visibleRows[rowIndex].task.id,
      date: dates[dateIndex],
    });
    pendingFocus.current = true;
    ensureDateVisible(dateIndex);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (visibleRows.length === 0) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
      return;
    }
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(-1, 0);
        break;
      case "ArrowRight":
        event.preventDefault();
        moveFocus(1, 0);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(0, -1);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveFocus(0, 1);
        break;
      case "Home": {
        event.preventDefault();
        const current = focused ?? defaultFocus;
        if (!current) {
          return;
        }
        const rowIndex = Math.max(
          0,
          visibleRows.findIndex((row) => row.task.id === current.taskId),
        );
        setFocused({
          taskId: visibleRows[rowIndex].task.id,
          date: data.today,
        });
        pendingFocus.current = true;
        jumpToToday();
        break;
      }
      case "Escape":
        event.preventDefault();
        pendingFocus.current = false;
        setFocused(null);
        (document.activeElement as HTMLElement | null)?.blur();
        break;
    }
  };

  useLayoutEffect(() => {
    if (!pendingFocus.current || !focused) {
      return;
    }
    const element =
      scrollerRef.current?.querySelector<HTMLElement>(
        `[data-task="${focused.taskId}"][data-date="${focused.date}"]`,
      );
    if (element) {
      element.focus({ preventScroll: true });
      pendingFocus.current = false;
    }
  }, [focused, scrollLeft, viewportWindow.start, viewportWindow.end]);

  const focusRowVisible = focused
    ? visibleRows.some((row) => row.task.id === focused.taskId)
    : true;

  useEffect(() => {
    if (focused && !focusRowVisible) {
      setFocused(null);
    }
  }, [focused, focusRowVisible]);

  const firstVisibleIndex = Math.min(
    dates.length - 1,
    Math.max(0, Math.floor(scrollLeft / cellSize)),
  );
  const firstVisible = dates[firstVisibleIndex];
  const monthDate = firstVisible ? parseISO(firstVisible) : null;
  const monthLabel = monthDate
    ? t("grid.month", {
        year: monthDate.getFullYear(),
        month: monthDate.getMonth() + 1,
      })
    : "";
  const ticks = monthTicks(dates);

  const cycle = (row: GridRow, date: string) => {
    const state = data.states.get(checkinKey(row.task.id, date)) ?? "none";
    void setStatus(row.task.id, date, nextCellState(state));
  };

  const openNote = (taskId: string, date: string, taskName: string) => {
    const cell = scrollerRef.current?.querySelector<HTMLElement>(
      `[data-task="${taskId}"][data-date="${date}"]`,
    );
    const card = cardRef.current;
    if (!cell || !card) {
      return;
    }
    const cellRect = cell.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const left = Math.min(
      Math.max(cellRect.left - cardRect.left - 88, 8),
      Math.max(8, cardRect.width - 216),
    );
    const top = Math.min(
      Math.max(cellRect.bottom - cardRect.top + 8, 8),
      Math.max(8, cardRect.height - 132),
    );
    setNoteDraft(data.checkins.get(checkinKey(taskId, date))?.note ?? "");
    setNoteTarget({ taskId, date, taskName, left, top });
  };

  const saveNote = () => {
    if (!noteTarget) {
      return;
    }
    void setNote(noteTarget.taskId, noteTarget.date, noteDraft);
    setNoteTarget(null);
  };

  /** 概览点击：回到详细缩放，并把该日期放到可视区中间。 */
  const zoomToDate = (date: string) => {
    const index = dates.indexOf(date);
    if (index < 0) {
      return;
    }
    const element = scrollerRef.current;
    const width = element?.clientWidth || effectiveWidth;
    const dateViewport = Math.max(0, width - TASK_COL_WIDTH);
    const nextSize = 32;
    const target = Math.max(0, index * nextSize - dateViewport / 2);

    if (element) {
      element.scrollLeft = target;
    }
    setScrollLeft(target);
    void useSettingsStore.getState().update({ gridZoom: nextSize });
  };

  const setZoom = (next: number) => {
    void useSettingsStore.getState().update({ gridZoom: next });
  };

  const rangeLabel = t("grid.range", {
    start: format(parseISO(data.axis.start), "MM/dd"),
    end: format(parseISO(data.axis.end), "MM/dd"),
    days: dates.length,
  });

  return (
    <>
      <header className="flex flex-none items-center gap-3">
        <h1 className="m-0 text-[var(--text-lg)] font-semibold tracking-[.2px]">
          {t("grid.title")}
        </h1>
        <span className="text-sm text-[var(--color-text-muted)]">
          {rangeLabel}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div
            role="group"
            aria-label={t("grid.mode.aria")}
            className="flex gap-0.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5"
          >
            <button
              type="button"
              aria-pressed={!overview}
              onClick={() => setZoom(32)}
              className={clsx(
                "rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[var(--text-2xs)]",
                !overview
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[0_1px_2px_rgba(0,0,0,.06)]"
                  : "text-[var(--color-text-muted)]",
              )}
            >
              {t("grid.mode.detail")}
            </button>
            <button
              type="button"
              aria-pressed={overview}
              onClick={() => setZoom(16)}
              className={clsx(
                "rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[var(--text-2xs)]",
                overview
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[0_1px_2px_rgba(0,0,0,.06)]"
                  : "text-[var(--color-text-muted)]",
              )}
            >
              {t("grid.mode.overview")}
            </button>
          </div>
          <button
            type="button"
            onClick={jumpToToday}
            className="rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[var(--text-2xs)] text-[var(--color-text-muted)] hover:bg-[var(--state-hover)]"
          >
            {t("grid.today")}
          </button>
        </div>
      </header>

      <div
        data-grid-filters
        className="flex flex-none flex-wrap items-center gap-2 text-[var(--text-2xs)] text-[var(--color-text-muted)]"
      >
        <span>{t("grid.filter.label")}</span>
        <div
          role="group"
          aria-label={t("grid.filter.aria")}
          className="flex gap-0.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5"
        >
          {(["all", "voluntary", "forced"] as const).map((category) => (
            <button
              key={category}
              type="button"
              data-filter-category={category}
              aria-pressed={filter.category === category}
              onClick={() => setGridFilter({ category })}
              className={clsx(
                "rounded-[var(--radius-pill)] px-2 py-0.5",
                filter.category === category
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[0_1px_2px_rgba(0,0,0,.06)]"
                  : "hover:bg-[var(--state-hover)]",
              )}
            >
              {t(
                category === "all"
                  ? "grid.filter.all"
                  : category === "voluntary"
                    ? "grid.filter.voluntary"
                    : "grid.filter.forced",
              )}
            </button>
          ))}
        </div>

        <select
          data-filter-task
          aria-label={t("grid.filter.task")}
          value={filter.taskId ?? ""}
          onChange={(event) =>
            setGridFilter({ taskId: event.target.value || null })
          }
          className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[var(--text-2xs)] text-[var(--color-text)]"
        >
          <option value="">{t("grid.filter.allTasks")}</option>
          {data.tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1">
          {t("grid.filter.from")}
          <input
            type="date"
            data-filter-from
            value={filter.from ?? ""}
            onChange={(event) =>
              setGridFilter({ from: event.target.value || null })
            }
            className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-[var(--text-2xs)] text-[var(--color-text)]"
          />
        </label>
        <label className="flex items-center gap-1">
          {t("grid.filter.to")}
          <input
            type="date"
            data-filter-to
            value={filter.to ?? ""}
            onChange={(event) =>
              setGridFilter({ to: event.target.value || null })
            }
            className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-[var(--text-2xs)] text-[var(--color-text)]"
          />
        </label>

        {filterActive ? (
          <button
            type="button"
            data-filter-clear
            onClick={() =>
              setGridFilter({
                category: "all",
                taskId: null,
                from: null,
                to: null,
              })
            }
            className="rounded-[var(--radius-control)] px-2 py-0.5 hover:bg-[var(--state-hover)]"
          >
            {t("grid.filter.clear")}
          </button>
        ) : null}
      </div>

      {allRows.length === 0 ? (
        <section className="flex min-h-0 flex-1 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-sm text-[var(--color-text-muted)]">
            {t(
              data.tasks.length > 0 ? "grid.filter.empty" : "grid.empty",
            )}
          </p>
        </section>
      ) : (
        <section
          ref={cardRef}
          data-grid-zoom={cellSize}
          data-mode={overview ? "overview" : "detail"}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
        >
          <div className="pointer-events-none absolute left-[160px] top-0 z-30 flex h-[22px] items-center border-b border-r border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[10px] text-[var(--color-text-muted)]">
            {monthLabel}
          </div>

          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            className="relative z-0 min-h-0 flex-1 overflow-auto"
            data-grid-scroller
          >
            <div style={{ width: totalWidth }} data-grid-content>
              {/* 月份带：只画分隔刻度，月份文字用上面的跟随 pill。 */}
              <div
                className="sticky top-0 z-20 flex bg-[var(--color-surface)]"
                style={{ height: MONTH_ROW_HEIGHT }}
              >
                <div
                  className="sticky left-0 z-40 w-[160px] shrink-0 border-b border-r border-[var(--color-border)] bg-[var(--color-surface)]"
                  style={{ height: MONTH_ROW_HEIGHT }}
                />
                <div
                  className="relative border-b border-[var(--color-border)]"
                  style={{
                    width: dates.length * cellSize,
                    height: MONTH_ROW_HEIGHT,
                  }}
                >
                  {ticks.map((tick) => (
                    <span
                      key={tick.key}
                      data-month-tick={tick.key}
                      className="absolute top-0 h-full border-l border-[var(--color-border)]"
                      style={{ left: tick.index * cellSize }}
                    />
                  ))}
                </div>
              </div>

              {/* 日期 / 星期 */}
              <div
                className="sticky z-20 flex bg-[var(--color-surface)]"
                style={{ top: MONTH_ROW_HEIGHT, height: DATE_ROW_HEIGHT }}
              >
                <div
                  className="sticky left-0 z-40 flex w-[160px] shrink-0 items-center border-b border-r border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[var(--text-2xs)] text-[var(--color-text-muted)]"
                  style={{ height: DATE_ROW_HEIGHT }}
                >
                  {t("grid.corner")}
                </div>
                <div style={{ width: viewportWindow.leftPad }} />
                {visibleDates.map((date) => (
                  <DateHeader
                    key={date}
                    date={date}
                    width={cellSize}
                    isToday={date === data.today}
                    overview={overview}
                    language={data.settings.language}
                  />
                ))}
                <div style={{ width: viewportWindow.rightPad }} />
              </div>

              {groups.map((group) => (
                <GridGroup
                  key={group.key}
                  groupKey={group.key}
                  rows={group.rows}
                  open={!collapsed[group.key]}
                  onToggle={() =>
                    setCollapsed((current) => ({
                      ...current,
                      [group.key]: !current[group.key],
                    }))
                  }
                  dates={visibleDates}
                  leftPad={viewportWindow.leftPad}
                  rightPad={viewportWindow.rightPad}
                  totalWidth={totalWidth}
                  cellSize={cellSize}
                  rowHeight={rowHeight}
                  groupHeight={groupHeight}
                  overview={overview}
                  today={data.today}
                  states={data.states}
                  checkins={data.checkins}
                  focused={focused}
                  defaultFocus={defaultFocus}
                  onFocusCell={(taskId, date) => setFocused({ taskId, date })}
                  onOpenNote={openNote}
                  onReorder={(fromId, toId) =>
                    handleReorder(group.key, fromId, toId)
                  }
                  dragEnabled={!filterActive}
                  onCycle={cycle}
                  onZoomDate={zoomToDate}
                />
              ))}
            </div>
          </div>

          {noteTarget ? (
            <div
              data-note-bubble
              className="absolute z-40 w-[208px] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-popover)]"
              style={{ left: noteTarget.left, top: noteTarget.top }}
            >
              <div className="mb-1 flex items-center gap-2 text-[var(--text-2xs)] text-[var(--color-text-muted)]">
                <span className="truncate">
                  {format(parseISO(noteTarget.date), "MM/dd")}{" "}
                  {noteTarget.taskName}
                </span>
                <span className="ml-auto shrink-0">
                  {t("grid.note.title")}
                </span>
              </div>
              <textarea
                autoFocus
                value={noteDraft}
                aria-label={t("grid.note.title")}
                placeholder={t("grid.note.placeholder")}
                onChange={(event) => setNoteDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setNoteTarget(null);
                  }
                }}
                className="h-16 w-full resize-none rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg)] p-1.5 text-xs text-[var(--color-text)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              />
              <div className="mt-1.5 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setNoteTarget(null)}
                  className="rounded-[var(--radius-control)] px-2 py-1 text-[var(--text-2xs)] text-[var(--color-text-muted)] hover:bg-[var(--state-hover)]"
                >
                  {t("grid.note.cancel")}
                </button>
                <button
                  type="button"
                  onClick={saveNote}
                  className="rounded-[var(--radius-control)] bg-[var(--color-voluntary)] px-2 py-1 text-[var(--text-2xs)] font-semibold text-white"
                >
                  {t("grid.note.save")}
                </button>
              </div>
            </div>
          ) : null}

          <footer className="flex h-[30px] flex-none items-center gap-1.5 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[10px] text-[var(--color-text-muted)]">
            <span>{t("grid.taskCount", { count: allRows.length })}</span>
            <span className="text-[var(--color-border-strong)]">·</span>
            <span>{t("grid.dayCount", { count: dates.length })}</span>
            <span className="ml-auto">{t("grid.zoomHint")}</span>
          </footer>
        </section>
      )}
    </>
  );
}

function DateHeader({
  date,
  width,
  isToday,
  overview,
  language,
}: {
  date: string;
  width: number;
  isToday: boolean;
  overview: boolean;
  language: Language;
}) {
  const parsed = parseISO(date);
  return (
    <div
      data-date-header={date}
      data-today={isToday ? "" : undefined}
      className={clsx(
        "flex shrink-0 flex-col items-center justify-center gap-px border-b border-l tabular-nums",
        overview ? "text-[9px]" : "text-[var(--text-2xs)]",
        isToday
          ? "font-bold text-[var(--color-voluntary)]"
          : "text-[var(--color-text)]",
      )}
      style={{
        width,
        height: DATE_ROW_HEIGHT,
        background: isToday
          ? "color-mix(in srgb, var(--color-voluntary) 9%, transparent)"
          : undefined,
        borderLeftColor:
          "color-mix(in srgb, var(--color-border) 55%, transparent)",
      }}
    >
      <b className="font-medium leading-none">{format(parsed, "d")}</b>
      {overview ? null : (
        <small className="text-[9px] font-normal leading-none text-[var(--color-text-muted)]">
          {format(parsed, "EEEEEE", { locale: dateLocale(language) })}
        </small>
      )}
    </div>
  );
}

function GridGroup({
  groupKey,
  rows,
  open,
  onToggle,
  dates,
  leftPad,
  rightPad,
  totalWidth,
  cellSize,
  rowHeight,
  groupHeight,
  overview,
  today,
  states,
  checkins,
  focused,
  defaultFocus,
  onFocusCell,
  onOpenNote,
  onReorder,
  dragEnabled,
  onCycle,
  onZoomDate,
}: {
  groupKey: GroupKey;
  rows: GridRow[];
  open: boolean;
  onToggle: () => void;
  dates: string[];
  leftPad: number;
  rightPad: number;
  totalWidth: number;
  cellSize: number;
  rowHeight: number;
  groupHeight: number;
  overview: boolean;
  today: string;
  states: Map<string, CellState>;
  checkins: Map<string, Checkin>;
  focused: { taskId: string; date: string } | null;
  defaultFocus: { taskId: string; date: string } | null;
  onFocusCell: (taskId: string, date: string) => void;
  onOpenNote: (taskId: string, date: string, taskName: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  dragEnabled: boolean;
  onCycle: (row: GridRow, date: string) => void;
  onZoomDate: (date: string) => void;
}) {
  const t = useT();
  const meta = GROUP_META[groupKey];
  const label = t(meta.labelKey);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  return (
    <>
      <div className="flex" style={{ width: totalWidth, height: groupHeight }}>
        <button
          type="button"
          data-group-header={groupKey}
          aria-expanded={open}
          aria-label={t(open ? "grid.collapse" : "grid.expand", {
            group: label,
          })}
          onClick={onToggle}
          style={{ height: groupHeight }}
          className="sticky left-0 z-10 flex w-[160px] shrink-0 items-center gap-1.5 border-b border-r border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[var(--text-2xs)] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--state-hover)]"
        >
          <span className="w-2 text-[9px]">{open ? "▾" : "▸"}</span>
          <i
            className="h-[11px] w-[3px] rounded-[2px]"
            style={{ background: meta.color }}
          />
          {label}
          <span className="ml-auto pr-1 font-normal tabular-nums">
            {rows.length}
          </span>
        </button>
        <div
          className="flex-1 border-b border-[var(--color-border)] bg-[var(--color-surface)]"
          style={{ minWidth: 0, height: groupHeight }}
        />
      </div>

      {open
        ? rows.map((row) => (
            <div
              key={row.task.id}
              data-grid-row={row.task.id}
              data-disabled={row.disabled ? "" : undefined}
              data-dragging={draggingId === row.task.id ? "" : undefined}
              data-drop-target={dropTargetId === row.task.id ? "" : undefined}
              className={clsx(
                "group/row flex",
                draggingId === row.task.id && "opacity-60",
              )}
              style={{
                width: totalWidth,
                height: rowHeight,
                boxShadow:
                  dropTargetId === row.task.id
                    ? "inset 0 2px 0 var(--color-voluntary)"
                    : undefined,
              }}
              onDragOver={
                dragEnabled
                  ? (event) => {
                      if (!draggingId || draggingId === row.task.id) {
                        return;
                      }
                      event.preventDefault();
                      if (event.dataTransfer) {
                        event.dataTransfer.dropEffect = "move";
                      }
                      setDropTargetId(row.task.id);
                    }
                  : undefined
              }
              onDragLeave={
                dragEnabled
                  ? () =>
                      setDropTargetId((current) =>
                        current === row.task.id ? null : current,
                      )
                  : undefined
              }
              onDrop={
                dragEnabled
                  ? (event) => {
                      event.preventDefault();
                      if (draggingId && draggingId !== row.task.id) {
                        onReorder(draggingId, row.task.id);
                      }
                      setDraggingId(null);
                      setDropTargetId(null);
                    }
                  : undefined
              }
              onDragEnd={
                dragEnabled
                  ? () => {
                      setDraggingId(null);
                      setDropTargetId(null);
                    }
                  : undefined
              }
            >
              <div
                draggable={dragEnabled}
                onDragStart={
                  dragEnabled
                    ? (event) => {
                        setDraggingId(row.task.id);
                        if (event.dataTransfer) {
                          event.dataTransfer.setData(
                            "text/plain",
                            row.task.id,
                          );
                          event.dataTransfer.effectAllowed = "move";
                        }
                      }
                    : undefined
                }
                title={dragEnabled ? t("grid.drag") : undefined}
                style={{ height: rowHeight }}
                className={clsx(
                  "sticky left-0 z-10 flex w-[160px] shrink-0 cursor-grab items-center gap-1.5 border-b border-r border-[var(--color-border)] bg-[var(--color-surface)] px-2 active:cursor-grabbing",
                  overview ? "text-[var(--text-2xs)]" : "text-xs",
                  row.disabled && "text-[var(--color-text-muted)]",
                )}
              >
                <i
                  className="size-[5px] shrink-0 rounded-full"
                  style={{
                    background:
                      groupKey === "disabled"
                        ? "var(--color-border-strong)"
                        : meta.color,
                    opacity: row.disabled ? 0.35 : 1,
                  }}
                />
                <span className="truncate">{row.task.name}</span>
                {dragEnabled ? (
                  <span
                    aria-hidden="true"
                    className="ml-auto shrink-0 text-[9px] text-[var(--color-border-strong)] opacity-0 group-hover/row:opacity-100"
                  >
                    ⋮⋮
                  </span>
                ) : null}
              </div>

              <div style={{ width: leftPad }} />
              {dates.map((date) => {
                const key = checkinKey(row.task.id, date);
                const state = states.get(key) ?? "none";
                const note = checkins.get(key)?.note ?? null;
                const isFocused =
                  focused?.taskId === row.task.id &&
                  focused.date === date;
                const isDefault =
                  defaultFocus?.taskId === row.task.id &&
                  defaultFocus.date === date;
                return (
                  <GridCell
                    key={date}
                    taskId={row.task.id}
                    taskName={row.task.name}
                    date={date}
                    state={state}
                    width={cellSize}
                    height={rowHeight}
                    isToday={date === today}
                    overview={overview}
                    focused={isFocused}
                    tabIndex={isFocused || (!focused && isDefault) ? 0 : -1}
                    hasNote={Boolean(note)}
                    disabled={
                      row.disabled || (!overview && state === "none")
                    }
                    onFocus={() => onFocusCell(row.task.id, date)}
                    onOpenNote={() =>
                      onOpenNote(row.task.id, date, row.task.name)
                    }
                    onActivate={
                      overview
                        ? () => onZoomDate(date)
                        : () => onCycle(row, date)
                    }
                  />
                );
              })}
              <div style={{ width: rightPad }} />
            </div>
          ))
        : null}
    </>
  );
}

const TODAY_TINT =
  "color-mix(in srgb, var(--color-voluntary) 8%, transparent)";

function overviewBackground(state: CellState): string | undefined {
  switch (state) {
    case "done":
      return "var(--color-voluntary)";
    case "missed":
      return "color-mix(in srgb, var(--color-missed) 55%, var(--color-surface))";
    case "skipped":
      return "color-mix(in srgb, var(--color-forced) 35%, var(--color-surface))";
    case "recorded":
      return "color-mix(in srgb, var(--color-text-muted) 35%, var(--color-surface))";
    case "none":
      return "var(--color-na)";
    case "pending":
      return undefined;
  }
}

function GridCell({
  taskId,
  taskName,
  date,
  state,
  width,
  height,
  isToday,
  overview,
  focused,
  tabIndex,
  hasNote,
  disabled,
  onFocus,
  onOpenNote,
  onActivate,
}: {
  taskId: string;
  taskName: string;
  date: string;
  state: CellState;
  width: number;
  height: number;
  isToday: boolean;
  overview: boolean;
  focused: boolean;
  tabIndex: number;
  hasNote: boolean;
  disabled: boolean;
  onFocus: () => void;
  onOpenNote: () => void;
  onActivate: () => void;
}) {
  const t = useT();
  const symbol = state === "none" ? "▫" : CELL_SYMBOLS[state];
  const canNote =
    !overview &&
    (state === "done" ||
      state === "missed" ||
      state === "skipped" ||
      state === "recorded");

  const detailBackground = isToday ? TODAY_TINT : undefined;
  const background = overview
    ? (overviewBackground(state) ??
      (isToday ? TODAY_TINT : undefined))
    : (detailBackground ??
      (state === "none" ? "var(--color-na)" : undefined));

  return (
    <div className="group relative shrink-0" style={{ width, height }}>
      <button
        type="button"
        data-grid-cell={taskId}
        data-task={taskId}
        data-date={date}
        data-state={state}
        data-today={isToday ? "" : undefined}
        data-focused={focused ? "" : undefined}
        tabIndex={tabIndex}
        disabled={disabled}
        aria-label={t("checkin.aria", {
          task: taskName,
          status: t(CELL_LABEL_KEYS[state]),
        })}
        onFocus={onFocus}
        onClick={onActivate}
        className={clsx(
          "flex size-full items-center justify-center border-b border-l tabular-nums outline-none",
          overview ? "text-[0px]" : "text-xs",
          !overview &&
            state === "done" &&
            "font-semibold text-[var(--color-voluntary)]",
          !overview && state === "missed" && "text-[var(--color-missed)]",
          !overview &&
            (state === "skipped" || state === "recorded") &&
            "text-[var(--color-text-muted)]",
          !overview && state === "pending" && "text-[var(--color-text)]",
          disabled
            ? "cursor-not-allowed"
            : overview
              ? "cursor-zoom-in hover:brightness-105"
              : "cursor-pointer hover:bg-[var(--state-hover)]",
        )}
        style={{
          background,
          color:
            !overview && state === "none"
              ? "color-mix(in srgb, var(--color-text) 28%, transparent)"
              : undefined,
          boxShadow: focused
            ? "inset 0 0 0 2px var(--color-voluntary)"
            : isToday
              ? "inset -1px 0 0 color-mix(in srgb, var(--color-voluntary) 45%, transparent)"
              : undefined,
          borderLeftColor:
            "color-mix(in srgb, var(--color-border) 50%, transparent)",
          borderBottomColor:
            "color-mix(in srgb, var(--color-border) 50%, transparent)",
        }}
      >
        <span aria-hidden="true">{overview ? "" : symbol}</span>
      </button>

      {canNote ? (
        <button
          type="button"
          data-note-button={checkinKey(taskId, date)}
          tabIndex={focused ? 0 : -1}
          aria-label={t(hasNote ? "grid.note.has" : "grid.note.add")}
          title={t("grid.note.title")}
          onClick={(event) => {
            event.stopPropagation();
            onOpenNote();
          }}
          className={clsx(
            "absolute right-0 top-0 grid size-3 place-items-center rounded-bl-[4px] text-[8px] leading-none",
            hasNote
              ? "bg-[color-mix(in_srgb,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]"
              : "text-[var(--color-text-muted)] opacity-0 hover:bg-[var(--state-active)] focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          <span aria-hidden="true">{hasNote ? "•" : "✎"}</span>
        </button>
      ) : null}
    </div>
  );
}
