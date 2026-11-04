import { format, parseISO } from "date-fns";
import { useState } from "react";

import type { MessageKey } from "../../../shared/i18n";import {
  useTodoGroups,
  type TodoGroup,
  type TodoGroupKey,
  type TodoItem,
} from "../../../stores/selectors/todos";
import { useT } from "../../../ui/useT";

const CARD =
  "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

const GROUP_META: Record<TodoGroupKey, { labelKey: MessageKey; color: string }> =
  {
    overdue: { labelKey: "todos.group.overdue", color: "var(--color-missed)" },
    today: { labelKey: "todos.group.today", color: "var(--color-warning)" },
    thisWeek: {
      labelKey: "todos.group.week",
      color: "var(--color-border-strong)",
    },
    later: { labelKey: "todos.group.later", color: "var(--color-border-strong)" },
    done: { labelKey: "todos.group.done", color: "var(--color-voluntary)" },
  };

export default function Todos() {
  const t = useT();
  const data = useTodoGroups();
  const [doneOpen, setDoneOpen] = useState(false);

  const done = data.groups.find((group) => group.key === "done");
  const open = data.groups.filter((group) => group.key !== "done");

  return (
    <>
      <header className="flex items-baseline gap-3">
        <h1 className="m-0 text-[var(--text-lg)] font-semibold tracking-[.2px]">
          {t("todos.title")}
        </h1>
        <span className="text-sm text-[var(--color-text-muted)]">
          {t("todos.pending", { count: data.pendingCount })}
        </span>
      </header>

      {data.pendingCount === 0 ? (
        <section
          data-todos-empty
          aria-live="polite"
          className={`${CARD} flex min-h-0 flex-1 items-center justify-center`}
        >
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("todos.empty")}
          </p>
        </section>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {open
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <TodoSection key={group.key} group={group} today={data.today} />
            ))}

          {done && done.items.length > 0 ? (
            <section data-todo-group="done">
              <button
                type="button"
                data-done-toggle
                aria-expanded={doneOpen}
                onClick={() => setDoneOpen((current) => !current)}
                className="flex h-[34px] w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--state-hover)]"
              >
                <span className="w-2 text-[9px]">{doneOpen ? "▾" : "▸"}</span>
                <i
                  className="h-3 w-[3px] rounded-[2px]"
                  style={{ background: GROUP_META.done.color }}
                />
                {t(GROUP_META.done.labelKey)}
                <span className="ml-auto font-normal tabular-nums">
                  {done.items.length}
                </span>
              </button>
              {doneOpen ? (
                <div className={`${CARD} p-2`}>
                  {done.items.map((item) => (
                    <TodoRow key={item.todo.id} item={item} today={data.today} />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}

function TodoSection({ group, today }: { group: TodoGroup; today: string }) {
  const t = useT();
  const meta = GROUP_META[group.key];

  return (
    <section
      data-todo-group={group.key}
      className={`${CARD} p-2`}
      aria-label={t(meta.labelKey)}
    >
      <div className="flex h-[34px] items-center gap-2 px-2 text-xs font-semibold text-[var(--color-text-muted)]">
        <i className="h-3 w-[3px] rounded-[2px]" style={{ background: meta.color }} />
        {t(meta.labelKey)}
        <span className="ml-auto font-normal tabular-nums">
          {group.items.length}
        </span>
      </div>
      {group.items.map((item) => (
        <TodoRow key={item.todo.id} item={item} today={today} />
      ))}
    </section>
  );
}

function TodoRow({ item, today }: { item: TodoItem; today: string }) {
  const t = useT();
  const { todo, overdueDays } = item;
  const overdue = overdueDays > 0;
  const dueToday = todo.dueDate === today;

  return (
    <div
      data-todo={todo.id}
      data-overdue={overdue ? "" : undefined}
      data-done={todo.done ? "" : undefined}
      className={`relative flex h-[34px] items-center gap-3 rounded-[var(--radius-control)] px-2 hover:bg-[var(--state-hover)] ${
        overdue
          ? "pl-5 before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[3px] before:rounded-[2px] before:bg-[var(--color-missed)]"
          : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-3.5 shrink-0 rounded-full border-[1.5px] border-[var(--color-border-strong)] ${
          todo.done ? "bg-[var(--color-voluntary)]" : ""
        }`}
      />
      <span
        className={
          todo.done
            ? "min-w-0 truncate text-[var(--color-text-muted)] line-through"
            : "min-w-0 truncate"
        }
      >
        {todo.title}
      </span>
      <span className="ml-auto flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        {todo.dueDate ? (
          <span data-due={todo.dueDate}>
            {format(parseISO(todo.dueDate), "MM/dd")}
          </span>
        ) : (
          <span>{t("todos.noDue")}</span>
        )}
        {overdue ? (
          <span className="rounded-[var(--radius-pill)] bg-[color-mix(in_srgb,var(--color-missed)_12%,transparent)] px-[7px] py-px text-[var(--text-2xs)] font-semibold text-[var(--color-missed)]">
            {t("todos.overdueDays", { days: overdueDays })}
          </span>
        ) : dueToday ? (
          <span className="rounded-[var(--radius-pill)] bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] px-[7px] py-px text-[var(--text-2xs)] font-semibold text-[var(--color-warning)]">
            {t("todos.dueToday")}
          </span>
        ) : null}
      </span>
    </div>
  );
}
