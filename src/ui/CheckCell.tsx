import { clsx } from "clsx";

import type { CellState } from "../domain/types";
import type { MessageKey } from "../shared/i18n";
import { useT } from "./useT";

export const CELL_SYMBOLS: Record<CellState, string> = {
  done: "✓",
  missed: "✗",
  skipped: "–",
  recorded: "•",
  pending: "",
  none: "",
};

export const CELL_LABEL_KEYS: Record<CellState, MessageKey> = {
  done: "checkin.done",
  missed: "checkin.missed",
  skipped: "checkin.skipped",
  recorded: "checkin.recorded",
  pending: "checkin.pending",
  none: "checkin.none",
};

// 状态色整组覆盖，避免基础 bg / border 与状态类在同优先级下互相打架。
const STATE_CLASS: Record<CellState, string> = {
  done: "border-[var(--color-voluntary)] bg-[var(--color-voluntary)] text-white",
  missed: "border-[var(--color-missed)] bg-transparent text-[var(--color-missed)]",
  skipped:
    "border-dashed border-[var(--color-border-strong)] bg-[var(--color-na)] text-[var(--color-text-muted)]",
  recorded:
    "border-[var(--color-border-strong)] bg-transparent text-[var(--color-text-muted)]",
  pending:
    "border-[var(--color-border-strong)] bg-transparent text-[var(--color-text)]",
  none: "border-[var(--color-border-strong)] bg-transparent text-[var(--color-text)] opacity-40",
};

export interface CheckCellProps {
  state: CellState;
  taskName: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: "row" | "grid";
}

export function CheckCell({
  state,
  taskName,
  onClick,
  disabled,
  size = "row",
}: CheckCellProps) {
  const t = useT();

  return (
    <button
      type="button"
      data-state={state}
      aria-label={t("checkin.aria", {
        task: taskName,
        status: t(CELL_LABEL_KEYS[state]),
      })}
      disabled={disabled || state === "none"}
      onClick={
        onClick
          ? (event) => {
              event.stopPropagation();
              onClick();
            }
          : undefined
      }
      className={clsx(
        "grid shrink-0 place-items-center rounded-[6px] border-[1.5px] text-xs font-bold leading-none transition-colors",
        size === "row"
          ? "size-[var(--check-size)]"
          : "size-[calc(var(--cell-size)-10px)]",
        STATE_CLASS[state],
        "hover:border-[var(--color-voluntary)] disabled:cursor-not-allowed",
      )}
    >
      <span aria-hidden="true">{CELL_SYMBOLS[state]}</span>
    </button>
  );
}
