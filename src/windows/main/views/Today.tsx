import { format, parseISO } from "date-fns";

import { nextCellState } from "../../../domain/settle";
import { useCheckinsStore } from "../../../stores/checkinsStore";
import {
  useTodayData,
  type CategoryStat,
  type TodayTask,
} from "../../../stores/selectors/today";
import { CheckCell } from "../../../ui/CheckCell";
import { ProgressRing } from "../../../ui/ProgressRing";

const CARD =
  "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

export default function Today() {
  const data = useTodayData();
  const setStatus = useCheckinsStore((state) => state.setStatus);

  const toggle = (row: TodayTask) => {
    void setStatus(row.task.id, data.today, nextCellState(row.state));
  };

  const toggleSkip = (row: TodayTask) => {
    void setStatus(
      row.task.id,
      data.today,
      row.state === "skipped" ? null : "skipped",
    );
  };

  const total = data.progress.applicable - data.progress.skipped;

  return (
    <>
      <header className="flex items-baseline gap-3">
        <h1 className="m-0 text-[var(--text-lg)] font-semibold tracking-[.2px]">
          今日
        </h1>
        <span className="text-sm text-[var(--color-text-muted)]">
          {data.dateLabel}
        </span>
      </header>

      <section className={`${CARD} flex items-center gap-6 px-6 py-4`}>
        <ProgressRing done={data.progress.done} total={total} />
        <div className="flex flex-col gap-0.5">
          <div>
            已完成 <b>{data.progress.done}</b> / <b>{total}</b> 项
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            完成率 {Math.round(data.progress.ratio * 100)}% ·{" "}
            {total === 0
              ? "今天没有任务"
              : data.progress.pending > 0
                ? `还剩 ${data.progress.pending} 项`
                : "今天已收尾"}
          </div>
        </div>
        <div className="ml-auto flex gap-6">
          <SplitStat label="自愿" color="var(--color-voluntary)" stat={data.voluntaryStat} />
          <SplitStat label="被迫" color="var(--color-forced)" stat={data.forcedStat} />
        </div>
      </section>

      <section className={`${CARD} p-2`}>
        {data.voluntary.length === 0 && data.forced.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            今天没有需要打卡的任务
          </p>
        ) : (
          <>
            <TaskGroup
              title="自愿任务"
              color="var(--color-voluntary)"
              rows={data.voluntary}
              stat={data.voluntaryStat}
              onToggle={toggle}
              onSkip={toggleSkip}
            />
            <TaskGroup
              title="被迫任务"
              color="var(--color-forced)"
              rows={data.forced}
              stat={data.forcedStat}
              onToggle={toggle}
              onSkip={toggleSkip}
            />
          </>
        )}
      </section>

      {data.dueTodos.length > 0 ? (
        <section className={`${CARD} p-2`}>
          <div className="flex h-[34px] items-center gap-2 px-2 text-xs font-semibold text-[var(--color-text-muted)]">
            今日到期待办
            <span className="ml-auto font-normal tabular-nums">
              {data.dueTodos.length} 项
            </span>
          </div>
          {data.dueTodos.map(({ todo, overdueDays }) => (
            <div
              key={todo.id}
              data-overdue={overdueDays > 0 ? "" : undefined}
              className={`relative flex h-[34px] items-center gap-3 rounded-[var(--radius-control)] px-2 hover:bg-[var(--state-hover)] ${
                overdueDays > 0
                  ? "pl-5 before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[3px] before:rounded-[2px] before:bg-[var(--color-missed)]"
                  : ""
              }`}
            >
              <span className="size-3.5 shrink-0 rounded-full border-[1.5px] border-[var(--color-border-strong)]" />
              <span className="truncate">{todo.title}</span>
              <span className="ml-auto flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <span>{format(parseISO(todo.dueDate as string), "MM/dd")}</span>
                <span
                  className={
                    overdueDays > 0
                      ? "rounded-[var(--radius-pill)] bg-[color-mix(in_srgb,var(--color-missed)_12%,transparent)] px-[7px] py-px text-[var(--text-2xs)] font-semibold text-[var(--color-missed)]"
                      : "rounded-[var(--radius-pill)] bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] px-[7px] py-px text-[var(--text-2xs)] font-semibold text-[var(--color-warning)]"
                  }
                >
                  {overdueDays > 0 ? `逾期 ${overdueDays} 天` : "今天"}
                </span>
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </>
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
}: {
  title: string;
  color: string;
  rows: TodayTask[];
  stat: CategoryStat;
  onToggle: (row: TodayTask) => void;
  onSkip: (row: TodayTask) => void;
}) {
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
            {row.state === "skipped" ? "取消" : "今天不做"}
          </button>
        </div>
      ))}
    </div>
  );
}
