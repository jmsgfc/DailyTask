import { useStats, type TaskStat } from "../../../stores/selectors/stats";
import { useT } from "../../../ui/useT";

const CARD =
  "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

export default function Stats() {
  const t = useT();
  const { rows } = useStats();

  return (
    <>
      <header className="flex items-baseline gap-3">
        <h1 className="m-0 text-[var(--text-lg)] font-semibold tracking-[.2px]">
          {t("stats.title")}
        </h1>
        <span className="text-sm text-[var(--color-text-muted)]">
          {t("stats.subtitle")}
        </span>
      </header>

      {rows.length === 0 ? (
        <section
          data-stats-empty
          className={`${CARD} flex min-h-0 flex-1 items-center justify-center`}
        >
          <p className="text-sm text-[var(--color-text-muted)]">
            {t("stats.empty")}
          </p>
        </section>
      ) : (
        <section className={`${CARD} min-h-0 flex-1 overflow-auto`}>
          <table data-stats-table className="w-full border-collapse text-sm">
            <thead>
              <tr className="sticky top-0 z-10 bg-[var(--color-surface)] text-left text-xs text-[var(--color-text-muted)]">
                <th className="h-9 border-b border-[var(--color-border)] px-4 font-medium">
                  {t("stats.col.task")}
                </th>
                <th className="h-9 w-[140px] border-b border-[var(--color-border)] px-4 font-medium">
                  {t("stats.col.streak")}
                </th>
                <th className="h-9 w-[280px] border-b border-[var(--color-border)] px-4 font-medium">
                  {t("stats.col.rate")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <StatsRow key={row.task.id} row={row} />
              ))}
            </tbody>
          </table>

          <p className="m-0 border-t border-[var(--color-border)] px-4 py-2 text-[var(--text-2xs)] text-[var(--color-text-muted)]">
            {t("stats.note")}
          </p>
        </section>
      )}
    </>
  );
}

function StatsRow({ row }: { row: TaskStat }) {
  const t = useT();
  const percent = Math.round(row.rate * 100);
  const color =
    row.task.category === "voluntary"
      ? "var(--color-voluntary)"
      : "var(--color-forced)";

  return (
    <tr
      data-stats-row={row.task.id}
      data-streak={row.streak}
      data-rate={percent}
      className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--state-hover)]"
    >
      <td className="h-[38px] px-4">
        <div className="flex items-center gap-2">
          <i
            aria-hidden="true"
            className="size-[5px] shrink-0 rounded-full"
            style={{ background: color }}
          />
          <span className="truncate">{row.task.name}</span>
          <span className="shrink-0 text-[var(--text-2xs)] text-[var(--color-text-muted)]">
            {t(
              row.task.category === "voluntary"
                ? "manage.category.voluntary"
                : "manage.category.forced",
            )}
          </span>
        </div>
      </td>
      <td className="px-4 tabular-nums">
        {row.streak > 0 ? (
          <span className="rounded-[var(--radius-pill)] bg-[color-mix(in_srgb,var(--color-voluntary)_12%,transparent)] px-[7px] py-px text-[var(--text-2xs)] font-semibold text-[var(--color-voluntary)]">
            {t("stats.streakDays", { count: row.streak })}
          </span>
        ) : (
          <span className="text-[var(--color-text-muted)]">—</span>
        )}
      </td>
      <td className="px-4">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-[160px] overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-na)]">
            <div
              className="h-full rounded-[var(--radius-pill)]"
              style={{ width: `${percent}%`, background: color }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[var(--color-text-muted)]">
            {t("stats.rate", { percent })}
          </span>
        </div>
      </td>
    </tr>
  );
}
