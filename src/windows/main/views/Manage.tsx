import { format, parseISO } from "date-fns";
import type { ReactNode } from "react";

import type { MessageKey } from "../../../shared/i18n";
import {
  useManageRows,
  type ManageRow,
  type ManageStatus,
} from "../../../stores/selectors/manage";
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
  const { rows } = useManageRows();

  return (
    <>
      <header className="flex items-baseline gap-3">
        <h1 className="m-0 text-[var(--text-lg)] font-semibold tracking-[.2px]">
          {t("manage.title")}
        </h1>
        <span className="text-sm text-[var(--color-text-muted)]">
          {t("manage.count", { count: rows.length })}
        </span>
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
    </>
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
