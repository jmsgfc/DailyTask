import { clsx } from "clsx";
import { format, parseISO } from "date-fns";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import type { GridRow } from "../../../domain/grid";
import { monthTicks } from "../../../domain/grid";
import { checkinKey } from "../../../domain/keys";
import { nextCellState, type CellState } from "../../../domain/settle";
import type { Language } from "../../../domain/types";
import type { MessageKey } from "../../../shared/i18n";
import { dateLocale } from "../../../shared/i18n";
import { useCheckinsStore } from "../../../stores/checkinsStore";
import { useGridData } from "../../../stores/selectors/grid";
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

  const cellSize = Math.min(44, Math.max(14, data.settings.gridZoom));
  const dates = data.axis.dates;
  const totalWidth = TASK_COL_WIDTH + dates.length * cellSize;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(() =>
    scrollLeftForToday(data.axis.todayIndex, 832, cellSize),
  );
  const effectiveWidth = viewportWidth || 832;
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

  const jumpToToday = useCallback(() => {
    const element = scrollerRef.current;
    const width = element?.clientWidth || effectiveWidth;
    const target = scrollLeftForToday(
      data.axis.todayIndex,
      width,
      cellSize,
    );
    if (element) {
      element.scrollLeft = target;
    }
    setScrollLeft(target);
  }, [cellSize, data.axis.todayIndex, effectiveWidth]);

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

  const handleScroll = () => {
    const element = scrollerRef.current;
    if (element) {
      setScrollLeft(element.scrollLeft);
    }
  };

  const allGroups: { key: GroupKey; rows: GridRow[] }[] = [
    { key: "voluntary", rows: data.groups.voluntary },
    { key: "forced", rows: data.groups.forced },
    { key: "disabled", rows: data.groups.disabled },
  ];
  const groups = allGroups.filter((group) => group.rows.length > 0);

  const allRows = groups.flatMap((group) => group.rows);
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
        <button
          type="button"
          onClick={jumpToToday}
          className="ml-auto rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[var(--text-2xs)] text-[var(--color-text-muted)] hover:bg-[var(--state-hover)]"
        >
          {t("grid.today")}
        </button>
      </header>

      {allRows.length === 0 ? (
        <section className="flex min-h-0 flex-1 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("grid.empty")}
          </p>
        </section>
      ) : (
        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
          <div className="pointer-events-none absolute left-[160px] top-0 z-30 flex h-[22px] items-center border-r border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[10px] text-[var(--color-text-muted)]">
            {monthLabel}
          </div>

          <div
            ref={scrollerRef}
            onScroll={handleScroll}
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
                  today={data.today}
                  states={data.states}
                  onCycle={cycle}
                />
              ))}
            </div>
          </div>

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
  language,
}: {
  date: string;
  width: number;
  isToday: boolean;
  language: Language;
}) {
  const parsed = parseISO(date);
  return (
    <div
      data-date-header={date}
      data-today={isToday ? "" : undefined}
      className={clsx(
        "flex shrink-0 flex-col items-center justify-center gap-px border-b border-l text-[var(--text-2xs)] tabular-nums",
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
      <small className="text-[9px] font-normal leading-none text-[var(--color-text-muted)]">
        {format(parsed, "EEEEE", { locale: dateLocale(language) })}
      </small>
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
  today,
  states,
  onCycle,
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
  today: string;
  states: Map<string, CellState>;
  onCycle: (row: GridRow, date: string) => void;
}) {
  const t = useT();
  const meta = GROUP_META[groupKey];
  const label = t(meta.labelKey);

  return (
    <>
      <div
        className="flex"
        style={{ width: totalWidth, height: GROUP_ROW_HEIGHT }}
      >
        <button
          type="button"
          data-group-header={groupKey}
          aria-expanded={open}
          aria-label={t(open ? "grid.collapse" : "grid.expand", {
            group: label,
          })}
          onClick={onToggle}
          className="sticky left-0 z-10 flex h-[26px] w-[160px] shrink-0 items-center gap-1.5 border-b border-r border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[var(--text-2xs)] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--state-hover)]"
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
          className="h-[26px] flex-1 border-b border-[var(--color-border)] bg-[var(--color-surface)]"
          style={{ minWidth: 0 }}
        />
      </div>

      {open
        ? rows.map((row) => (
            <div
              key={row.task.id}
              data-grid-row={row.task.id}
              data-disabled={row.disabled ? "" : undefined}
              className="flex"
              style={{ width: totalWidth, height: TASK_ROW_HEIGHT }}
            >
              <div
                className={clsx(
                  "sticky left-0 z-10 flex w-[160px] shrink-0 items-center gap-1.5 border-b border-r border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs",
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
              </div>

              <div style={{ width: leftPad }} />
              {dates.map((date) => {
                const state = states.get(`${row.task.id}|${date}`) ?? "none";
                return (
                  <GridCell
                    key={date}
                    taskId={row.task.id}
                    taskName={row.task.name}
                    date={date}
                    state={state}
                    width={cellSize}
                    isToday={date === today}
                    disabled={row.disabled || state === "none"}
                    onCycle={() => onCycle(row, date)}
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

function GridCell({
  taskId,
  taskName,
  date,
  state,
  width,
  isToday,
  disabled,
  onCycle,
}: {
  taskId: string;
  taskName: string;
  date: string;
  state: CellState;
  width: number;
  isToday: boolean;
  disabled: boolean;
  onCycle: () => void;
}) {
  const t = useT();
  const symbol = state === "none" ? "▫" : CELL_SYMBOLS[state];

  return (
    <button
      type="button"
      data-grid-cell={taskId}
      data-task={taskId}
      data-date={date}
      data-state={state}
      data-today={isToday ? "" : undefined}
      disabled={disabled}
      aria-label={t("checkin.aria", {
        task: taskName,
        status: t(CELL_LABEL_KEYS[state]),
      })}
      onClick={onCycle}
      className={clsx(
        "flex h-[34px] shrink-0 items-center justify-center border-b border-l text-xs tabular-nums",
        state === "done" && "font-semibold text-[var(--color-voluntary)]",
        state === "missed" && "text-[var(--color-missed)]",
        (state === "skipped" || state === "recorded") &&
          "text-[var(--color-text-muted)]",
        state === "pending" && "text-[var(--color-text)]",
        disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-[var(--state-hover)]",
      )}
      style={{
        width,
        background: isToday
          ? "color-mix(in srgb, var(--color-voluntary) 8%, transparent)"
          : state === "none"
            ? "var(--color-na)"
            : undefined,
        color:
          state === "none"
            ? "color-mix(in srgb, var(--color-text) 28%, transparent)"
            : undefined,
        boxShadow: isToday
          ? "inset -1px 0 0 color-mix(in srgb, var(--color-voluntary) 45%, transparent)"
          : undefined,
        borderLeftColor:
          "color-mix(in srgb, var(--color-border) 50%, transparent)",
        borderBottomColor:
          "color-mix(in srgb, var(--color-border) 50%, transparent)",
      }}
    >
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}
