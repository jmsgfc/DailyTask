import { clsx } from "clsx";

import type { CellState } from "../domain/types";

const SYMBOLS: Record<CellState, string> = {
  done: "✓",
  missed: "✗",
  skipped: "–",
  pending: "",
  none: "",
};

const LABELS: Record<CellState, string> = {
  done: "已完成",
  missed: "未完成",
  skipped: "今天不做",
  pending: "未打卡",
  none: "不适用",
};

// 状态色整组覆盖，避免基础 bg / border 与状态类在同优先级下互相打架。
const STATE_CLASS: Record<CellState, string> = {
  done: "border-[var(--color-voluntary)] bg-[var(--color-voluntary)] text-white",
  missed: "border-[var(--color-missed)] bg-transparent text-[var(--color-missed)]",
  skipped:
    "border-dashed border-[var(--color-border-strong)] bg-[var(--color-na)] text-[var(--color-text-muted)]",
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
  return (
    <button
      type="button"
      data-state={state}
      aria-label={`${taskName}：${LABELS[state]}`}
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
      <span aria-hidden="true">{SYMBOLS[state]}</span>
    </button>
  );
}
