export type IntervalError = "emptyStart" | "endBeforeStart" | "overlapsPrevious";

/**
 * 编辑最新一段区间时的校验（D65）：
 * - 启用日期必填；
 * - 停用日期为空表示仍启用，否则必须 end ≥ start；
 * - 多段任务的新一段必须严格晚于上一段结束日，避免区间重叠。
 */
export function validateInterval(
  start: string,
  end: string | null,
  previousEnd: string | null,
): IntervalError | null {
  if (!start) {
    return "emptyStart";
  }
  if (end !== null && end < start) {
    return "endBeforeStart";
  }
  if (previousEnd !== null && start <= previousEnd) {
    return "overlapsPrevious";
  }
  return null;
}
