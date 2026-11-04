import { format, parseISO } from "date-fns";
import { useRef, useState, type FormEvent } from "react";

import type { MessageKey } from "../../../shared/i18n";
import {
  useTodoGroups,
  type TodoGroup,
  type TodoGroupKey,
  type TodoItem,
} from "../../../stores/selectors/todos";
import { useTodosStore } from "../../../stores/todosStore";
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
  const hasTodos = data.groups.some((group) => group.items.length > 0);

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

      <TodoForm />

      {!hasTodos ? (
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

/** 新增：标题必填，截止日期可空（空 = 「以后」）。 */
function TodoForm() {
  const t = useT();
  const create = useTodosStore((state) => state.create);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const canSubmit = title.trim().length > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    void create({ title: title.trim(), dueDate: dueDate || null });
    setTitle("");
    setDueDate("");
  };

  return (
    <form
      data-todo-form
      onSubmit={submit}
      className={`${CARD} flex flex-none items-center gap-2 px-3 py-2`}
    >
      <input
        data-todo-input
        value={title}
        aria-label={t("todos.addPlaceholder")}
        placeholder={t("todos.addPlaceholder")}
        onChange={(event) => setTitle(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none"
      />
      <input
        type="date"
        data-todo-due
        value={dueDate}
        aria-label={t("todos.dueLabel")}
        onChange={(event) => setDueDate(event.target.value)}
        className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[var(--text-2xs)] text-[var(--color-text)]"
      />
      <button
        type="submit"
        data-todo-add
        disabled={!canSubmit}
        className="rounded-[var(--radius-control)] bg-[var(--color-voluntary)] px-2.5 py-1 text-[var(--text-2xs)] font-semibold text-white disabled:opacity-40"
      >
        {t("todos.add")}
      </button>
    </form>
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
  const setDone = useTodosStore((state) => state.setDone);
  const update = useTodosStore((state) => state.update);
  const remove = useTodosStore((state) => state.remove);
  const { todo, overdueDays } = item;
  const overdue = overdueDays > 0;
  const dueToday = todo.dueDate === today;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const finished = useRef(false);

  const startEditing = () => {
    finished.current = false;
    setDraft(todo.title);
    setEditing(true);
  };

  const commit = () => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    setEditing(false);
    const next = draft.trim();
    if (!next || next === todo.title) {
      setDraft(todo.title);
      return;
    }
    void update(todo.id, { title: next });
  };

  return (
    <div
      data-todo={todo.id}
      data-overdue={overdue ? "" : undefined}
      data-done={todo.done ? "" : undefined}
      className={`group relative flex h-[34px] items-center gap-3 rounded-[var(--radius-control)] px-2 hover:bg-[var(--state-hover)] ${
        overdue
          ? "pl-5 before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[3px] before:rounded-[2px] before:bg-[var(--color-missed)]"
          : ""
      }`}
    >
      <button
        type="button"
        data-toggle-done
        aria-label={t(todo.done ? "todos.markUndone" : "todos.markDone", {
          title: todo.title,
        })}
        aria-pressed={todo.done}
        onClick={() => void setDone(todo.id, !todo.done)}
        className={`grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] text-[10px] leading-none ${
          todo.done
            ? "border-[var(--color-voluntary)] bg-[var(--color-voluntary)] text-white"
            : "border-[var(--color-border-strong)] text-transparent hover:border-[var(--color-voluntary)]"
        }`}
      >
        <span aria-hidden="true">✓</span>
      </button>

      {editing ? (
        <input
          autoFocus
          data-todo-title-input
          value={draft}
          aria-label={t("todos.rename")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              finished.current = true;
              setDraft(todo.title);
              setEditing(false);
            }
          }}
          onBlur={commit}
          className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-1.5 py-[2px] text-sm focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        />
      ) : (
        <span
          className={
            todo.done
              ? "min-w-0 truncate text-[var(--color-text-muted)] line-through"
              : "min-w-0 truncate"
          }
        >
          {todo.title}
        </span>
      )}

      <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-[var(--color-text-muted)]">
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

      <button
        type="button"
        data-todo-rename
        aria-label={t("todos.rename")}
        onClick={startEditing}
        className="shrink-0 rounded-[var(--radius-control)] px-1 text-xs text-[var(--color-text-muted)] opacity-0 hover:bg-[var(--state-active)] focus:opacity-100 group-hover:opacity-100"
      >
        <span aria-hidden="true">✎</span>
      </button>
      <button
        type="button"
        data-todo-delete
        aria-label={t("todos.deleteAria", { title: todo.title })}
        onClick={() => void remove(todo.id)}
        className="shrink-0 rounded-[var(--radius-control)] px-1 text-xs text-[var(--color-text-muted)] opacity-0 hover:bg-[var(--state-active)] hover:text-[var(--color-missed)] focus:opacity-100 group-hover:opacity-100"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
