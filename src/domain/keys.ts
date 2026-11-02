/** 打卡 Map 的键：taskId|date。domain 与 store 共用同一格式。 */
export function checkinKey(taskId: string, date: string): string {
  return `${taskId}|${date}`;
}
