/**
 * M3 挂件入口。D28 只负责窗口外壳，D30 再补日期、进度环与任务列表。
 * 外层 8px 留白给 CSS 阴影，纸卡本身 204×264。
 */
export function Widget() {
  return (
    <div className="h-full w-full p-2">
      <section className="flex h-full flex-col rounded-[var(--radius-widget)] border border-[var(--color-paper-edge)] bg-[var(--color-paper)] p-3 text-[var(--color-paper-text)] shadow-[var(--shadow-widget)]">
        <header className="flex items-center text-[var(--text-2xs)] text-[var(--color-paper-muted)]">
          <span>DailyTask</span>
          <span className="ml-auto">挂件</span>
        </header>
        <div className="grid flex-1 place-items-center text-xs text-[var(--color-paper-muted)]">
          220 × 280
        </div>
      </section>
    </div>
  );
}
