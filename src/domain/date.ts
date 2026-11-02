import {
  addDays as addDaysFns,
  differenceInCalendarDays,
  format,
  parseISO,
  subHours,
} from "date-fns";

export const DATE_FORMAT = "yyyy-MM-dd";

/** 本地时区的 YYYY-MM-DD，禁止直接 toISOString()（会跳 UTC 日期）。 */
export function formatDate(date: Date): string {
  return format(date, DATE_FORMAT);
}

/** 一天的起始时间：04:00 前算前一天。全应用唯一的“今天”来源。 */
export function logicalToday(now: Date, dayStartHour: number): string {
  return formatDate(subHours(now, dayStartHour));
}

export function addDays(date: string, days: number): string {
  return formatDate(addDaysFns(parseISO(date), days));
}

/** later - earlier，按日历天算，不受时分秒影响。 */
export function diffDays(later: string, earlier: string): number {
  return differenceInCalendarDays(parseISO(later), parseISO(earlier));
}

/** 闭区间 [start, end] 的日期列表。 */
export function range(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}
