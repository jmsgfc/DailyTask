import { format, parseISO } from "date-fns";
import { useState, type FormEvent, type ReactNode } from "react";

import type { MessageKey } from "../../../shared/i18n";
import type { TaskCategory } from "../../../domain/types";
import {
  useManageRows,
  type ManageRow,
  type ManageStatus,
} from "../../../stores/selectors/manage";
import { useTasksStore } from "../../../stores/tasksStore";
import { useT } from "../../../ui/useT";

const CARD =
  "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

const STATUS_META: Record<
  ManageStatus,
  { labelKey: MessageKey; className: string }
> = {
  active: {
    labelKey: "manage.status.active",
    className:
      "bg-[color-mix(in_srgb,var(--color-voluntary)_12%,transparent)] text-[var(--color-voluntary)]",
  },
  scheduled: {
    labelKey: "manage.status.scheduled",
    className:
      "bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] text-[var(--color-warning)]",
  },
  disabled: {
    labelKey: "manage.status.disabled",
    className:
      "bg-[var(--color-na)] text-[var(--color-text-muted)]",
  },
};

export default function Manage() {
  const t = useT();
  const { today, rows } = useManageRows();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <header className="flex items-baseline gap-3">
        <h1 className="m-0 text-[var(--text-lg)] font-semibold tracking-[.2px]">
          {t("manage.title")}
        </h1>
        <span className="text-sm text-[var(--color-text-muted)]">
          {t("manage.count", { count: rows.length })}
        </span>
        <button
          type="button"
          data-manage-new
          onClick={() => setCreating(true)}
          className="ml-auto rounded-[var(--radius-pill)] bg-[var(--color-voluntary)] px-3 py-1 text-[var(--text-2xs)] font-semibold text-white"
        >
          ＋ {t("manage.new")}
        </button>
      </header>

      {rows.length === 0 ? (
        <section
          data-manage-empty
          className={`${CARD} flex min-h-0 flex-1 items-center justify-center`}
        >
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("manage.empty")}
          </p>
        </section>
      ) : (
        <section className={`${CARD} min-h-0 flex-1 overflow-auto`}>
          <table
            data-manage-table
            className="w-full table-fixed border-collapse text-sm"
          >
            <colgroup>
              <col />
              <col className="w-[92px]" />
              <col className="w-[124px]" />
              <col className="w-[124px]" />
              <col className="w-[132px]" />
              <col className="w-[150px]" />
            </colgroup>
            <thead>
              <tr className="sticky top-0 z-10 bg-[var(--color-surface)] text-left text-xs text-[var(--color-text-muted)]">
                <Th>{t("manage.col.task")}</Th>
                <Th>{t("manage.col.category")}</Th>
                <Th>{t("manage.col.start")}</Th>
                <Th>{t("manage.col.end")}</Th>
                <Th>{t("manage.col.status")}</Th>
                <Th>{t("manage.col.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ManageTableRow key={row.task.id} row={row} />
              ))}
            </tbody>
          </table>
        </section>
      )}

      {creating ? (
        <CreateTaskDialog today={today} onClose={() => setCreating(false)} />
      ) : null}
    </>
  );
}

function CreateTaskDialog({
  today,
  onClose,
}: {
  today: string;
  onClose: () => void;
}) {
  const t = useT();
  const create = useTasksStore((state) => state.create);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TaskCategory>("voluntary");
  const [startDate, setStartDate] = useState(today);
  const canSubmit = name.trim().length > 0 && startDate.length > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    void create({ name: name.trim(), category, startDate });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label={t("manage.cancel")}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/25"
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-label={t("manage.newTitle")}
        data-new-task
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
        className="relative z-10 flex w-[360px] flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-popover)]"
      >
        <h2 className="m-0 text-sm font-semibold">{t("manage.newTitle")}</h2>

        <label className="flex flex-col gap-1 text-[var(--text-2xs)] text-[var(--color-text-muted)]">
          {t("manage.field.name")}
          <input
            autoFocus
            data-new-name
            value={name}
            placeholder={t("manage.namePlaceholder")}
            onChange={(event) => setName(event.target.value)}
            className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          />
        </label>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1 p-0 text-[var(--text-2xs)] text-[var(--color-text-muted)]">
            {t("manage.field.category")}
          </legend>
          <div className="flex gap-2">
            {(["voluntary", "forced"] as const).map((value) => (
              <label
                key={value}
                className={`flex-1 cursor-pointer rounded-[var(--radius-control)] border px-2 py-1 text-center text-xs ${
                  category === value
                    ? "border-[var(--color-voluntary)] bg-[color-mix(in_srgb,var(--color-voluntary)_10%,transparent)] font-semibold"
                    : "border-[var(--color-border)]"
                }`}
              >
                <input
                  type="radio"
                  name="category"
                  value={value}
                  data-new-category={value}
                  checked={category === value}
                  onChange={() => setCategory(value)}
                  className="sr-only"
                />
                {t(
                  value === "voluntary"
                    ? "manage.category.voluntary"
                    : "manage.category.forced",
                )}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-[var(--text-2xs)] text-[var(--color-text-muted)]">
          {t("manage.field.start")}
          <input
            type="date"
            data-new-start
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-text)]"
          />
        </label>

        <div className="mt-1 flex justify-end gap-1.5">
          <button
            type="button"
            data-new-cancel
            onClick={onClose}
            className="rounded-[var(--radius-control)] px-2.5 py-1 text-[var(--text-2xs)] text-[var(--color-text-muted)] hover:bg-[var(--state-hover)]"
          >
            {t("manage.cancel")}
          </button>
          <button
            type="submit"
            data-new-submit
            disabled={!canSubmit}
            className="rounded-[var(--radius-control)] bg-[var(--color-voluntary)] px-2.5 py-1 text-[var(--text-2xs)] font-semibold text-white disabled:opacity-40"
          >
            {t("manage.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      scope="col"
      className="h-9 border-b border-[var(--color-border)] px-3 font-medium"
    >
      {children}
    </th>
  );
}

function ManageTableRow({ row }: { row: ManageRow }) {
  const t = useT();
  const meta = STATUS_META[row.status];
  const retired = row.status === "disabled";

  return (
    <tr
      data-manage-row={row.task.id}
      data-status={row.status}
      className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--state-hover)]"
    >
      <td className="h-[38px] px-3">
        <div className="flex items-center gap-2">
          <i
            aria-hidden="true"
            className="size-[5px] shrink-0 rounded-full"
            style={{
              background:
                row.task.category === "voluntary"
                  ? "var(--color-voluntary)"
                  : "var(--color-forced)",
              opacity: retired ? 0.35 : 1,
            }}
          />
          <span
            className={
              retired
                ? "truncate text-[var(--color-text-muted)]"
                : "truncate"
            }
          >
            {row.task.name}
          </span>
          {row.intervalCount > 1 ? (
            <span
              data-interval-count={row.intervalCount}
              title={t("manage.intervalsHint")}
              className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--color-na)] px-1.5 py-px text-[var(--text-2xs)] text-[var(--color-text-muted)]"
            >
              {t("manage.intervals", { count: row.intervalCount })}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 text-[var(--color-text-muted)]">
        {t(
          row.task.category === "voluntary"
            ? "manage.category.voluntary"
            : "manage.category.forced",
        )}
      </td>
      <td className="px-3 tabular-nums text-[var(--color-text-muted)]">
        {row.start ? format(parseISO(row.start), "MM/dd") : t("manage.never")}
      </td>
      <td className="px-3 tabular-nums text-[var(--color-text-muted)]">
        {row.end ? format(parseISO(row.end), "MM/dd") : t("manage.never")}
      </td>
      <td className="px-3">
        <span
          className={`rounded-[var(--radius-pill)] px-[7px] py-px text-[var(--text-2xs)] font-semibold ${meta.className}`}
        >
          {t(meta.labelKey)}
        </span>
      </td>
      <td className="px-3 text-[var(--text-2xs)] text-[var(--color-text-muted)]">
        —
      </td>
    </tr>
  );
}
