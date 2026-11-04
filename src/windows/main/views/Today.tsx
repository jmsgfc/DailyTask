import { format, parseISO } from "date-fns";
import { useRef, useState } from "react";

import { nextCellState } from "../../../domain/settle";
import { useCheckinsStore } from "../../../stores/checkinsStore";
import {
  useTodayData,
  type CategoryStat,
  type DueTodoItem,
  type TodayTask,
} from "../../../stores/selectors/today";
import { useTodosStore } from "../../../stores/todosStore";
import { CheckCell } from "../../../ui/CheckCell";
import { ProgressRing } from "../../../ui/ProgressRing";
import { useT } from "../../../ui/useT";

const CARD =
  "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

export default function Today() {
  const t = useT();
  const data = useTodayData();
  const setStatus = useCheckinsStore((state) => state.setStatus);
  const setValue = useCheckinsStore((state) => state.setValue);
  const setTodoDone = useTodosStore((state) => state.setDone);

  const completeTodo = (item: DueTodoItem) => {
    void setTodoDone(item.todo.id, true);
  };

  const toggle = (row: TodayTask) => {
    void setStatus(row.task.id, data.today, nextCellState(row.state));
  };

  const saveValue = (row: TodayTask, value: string) => {
    void setValue(row.task.id, data.today, value.trim() === "" ? null : value);
  };

  const toggleSkip = (row: TodayTask) => {
    void setStatus(
      row.task.id,
      data.today,
      row.state === "skipped" ? null : "skipped",
    );
  };

  const total =
    data.progress.applicable - data.progress.skipped - data.progress.recorded;
  const statusText =
    total === 0
      ? t("today.noTasks")
      : data.progress.pending > 0
        ? t("today.remaining", { count: data.progress.pending })
        : t("today.allDone");

  return (
    <>
      <header className="flex items-baseline gap-3">
        <h1 className="m-0 text-[var(--text-lg)] font-semibold tracking-[.2px]">
          {t("today.title")}
        </h1>
        <span className="text-sm text-[var(--color-text-muted)]">
          {data.dateLabel}
        </span>
      </header>

      <section className={`${CARD} flex items-center gap-6 px-6 py-4`}>
        <ProgressRing done={data.progress.done} total={total} />
        <div className="flex flex-col gap-0.5">
          <div>{t("today.doneOfTotal", { done: data.progress.done, total })}</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {t("today.rate", {
              percent: Math.round(data.progress.ratio * 100),
              status: statusText,
            })}
          </div>
        </div>
        <div className="ml-auto flex gap-6">
          <SplitStat
            label={t("today.category.voluntary")}
            color="var(--color-voluntary)"
            stat={data.voluntaryStat}
          />
          <SplitStat
            label={t("today.category.forced")}
            color="var(--color-forced)"
            stat={data.forcedStat}
          />
        </div>
      </section>

      <section className={`${CARD} p-2`}>
        {data.voluntary.length === 0 && data.forced.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            {t("today.empty")}
          </p>
        ) : (
          <>
            <TaskGroup
              title={t("today.group.voluntary")}
              color="var(--color-voluntary)"
              rows={data.voluntary}
              stat={data.voluntaryStat}
              onToggle={toggle}
              onSkip={toggleSkip}
              onValue={saveValue}
            />
            <TaskGroup
              title={t("today.group.forced")}
              color="var(--color-forced)"
              rows={data.forced}
              stat={data.forcedStat}
              onToggle={toggle}
              onSkip={toggleSkip}
              onValue={saveValue}
            />
          </>
        )}
      </section>

      {data.dueTodos.length > 0 ? (
        <section className={`${CARD} p-2`}>
          <div className="flex h-[34px] items-center gap-2 px-2 text-xs font-semibold text-[var(--color-text-muted)]">
            {t("today.dueTodos")}
            <span className="ml-auto font-normal tabular-nums">
              {t("common.itemCount", { count: data.dueTodos.length })}
            </span>
          </div>
          {data.overdueTodos.map((item) => (
            <DueTodoRow
              key={item.todo.id}
              item={item}
              onComplete={() => completeTodo(item)}
            />
          ))}
          {data.todayTodos.map((item) => (
            <DueTodoRow
              key={item.todo.id}
              item={item}
              onComplete={() => completeTodo(item)}
            />
          ))}
        </section>
      ) : null}
    </>
  );
}

/** 单区块内按「逾期 → 今天」排列，红条/红 chip 与黄 chip 做视觉分组。 */
function DueTodoRow({
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
      data-group={overdue ? "overdue" : "today"}
      data-overdue={overdue ? "" : undefined}
      aria-label={t("todos.markDone", { title: todo.title })}
      onClick={onComplete}
      className={`relative flex h-[34px] w-full items-center gap-3 rounded-[var(--radius-control)] px-2 text-left hover:bg-[var(--state-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ${
        overdue
          ? "pl-5 before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[3px] before:rounded-[2px] before:bg-[var(--color-missed)]"
          : ""
      }`}
    >
      <span
        aria-hidden="true"
        className="grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] border-[var(--color-border-strong)] text-[10px] leading-none text-transparent"
      />
      <span className="min-w-0 truncate">{todo.title}</span>
      <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <span>{format(parseISO(todo.dueDate as string), "MM/dd")}</span>
        <span
          className={
            overdue
              ? "rounded-[var(--radius-pill)] bg-[color-mix(in_srgb,var(--color-missed)_12%,transparent)] px-[7px] py-px text-[var(--text-2xs)] font-semibold text-[var(--color-missed)]"
              : "rounded-[var(--radius-pill)] bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] px-[7px] py-px text-[var(--text-2xs)] font-semibold text-[var(--color-warning)]"
          }
        >
          {overdue
            ? t("today.overdueDays", { days: overdueDays })
            : t("today.dueToday")}
        </span>
      </span>
    </button>
  );
}

function SplitStat({
  label,
  color,
  stat,
}: {
  label: string;
  color: string;
  stat: CategoryStat;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
        <i className="size-1.5 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className="tabular-nums">
        {stat.done} / {stat.total}
      </div>
    </div>
  );
}

function TaskGroup({
  title,
  color,
  rows,
  stat,
  onToggle,
  onSkip,
  onValue,
}: {
  title: string;
  color: string;
  rows: TodayTask[];
  stat: CategoryStat;
  onToggle: (row: TodayTask) => void;
  onSkip: (row: TodayTask) => void;
  onValue: (row: TodayTask, value: string) => void;
}) {
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex h-[34px] items-center gap-2 px-2 text-xs font-semibold text-[var(--color-text-muted)]">
        <i className="h-3 w-[3px] rounded-[2px]" style={{ background: color }} />
        {title}
        <span className="ml-auto font-normal tabular-nums">
          {stat.done} / {stat.total}
        </span>
      </div>

      {rows.map((row) => (
        <div
          key={row.task.id}
          role="button"
          tabIndex={0}
          data-status={row.state}
          onClick={() => onToggle(row)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggle(row);
            }
          }}
          className="group flex h-[34px] cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-2 hover:bg-[var(--state-hover)] active:bg-[var(--state-active)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          <CheckCell
            state={row.state}
            taskName={row.task.name}
            onClick={() => onToggle(row)}
          />
          <span
            className={
              row.state === "skipped"
                ? "min-w-0 truncate text-[var(--color-text-muted)] line-through"
                : row.state === "done"
                  ? "min-w-0 truncate text-[var(--color-text-muted)]"
                  : "min-w-0 truncate"
            }
          >
            {row.task.name}
          </span>
          {editingId === row.task.id ? (
            <ValueInput
              initial={row.value ?? ""}
              onCommit={(next) => {
                setEditingId(null);
                onValue(row, next);
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <button
              type="button"
              data-value={row.value ?? undefined}
              aria-label={t("today.editValue")}
              onClick={(event) => {
                event.stopPropagation();
                setEditingId(row.task.id);
              }}
              className={`shrink-0 rounded-[var(--radius-pill)] px-1.5 py-[2px] text-xs tabular-nums text-[var(--color-text-muted)] hover:bg-[var(--state-active)] ${
                row.value
                  ? "bg-[var(--state-hover)]"
                  : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              }`}
            >
              {row.value ?? t("today.addValue")}
            </button>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSkip(row);
            }}
            className={`ml-auto rounded-[var(--radius-control)] px-1.5 py-[3px] text-xs text-[var(--color-text-muted)] hover:bg-[var(--state-active)] ${
              row.state === "skipped"
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
            }`}
          >
            {row.state === "skipped" ? t("today.unskip") : t("today.skip")}
          </button>
        </div>
      ))}
    </div>
  );
}

/** 行内编辑自由值：Enter 提交、Esc 取消、失焦提交。 */
function ValueInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const cancelled = useRef(false);

  return (
    <input
      autoFocus
      value={value}
      aria-label={initial}
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          onCommit(value);
        }
        if (event.key === "Escape") {
          cancelled.current = true;
          onCancel();
        }
      }}
      onBlur={() => {
        if (!cancelled.current) {
          onCommit(value);
        }
      }}
      className="w-20 shrink-0 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-1.5 py-[2px] text-xs focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
    />
  );
}
