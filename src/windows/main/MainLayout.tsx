import { useUiStore, type ViewName } from "../../stores/uiStore";
import { Icon, type IconName } from "../../ui/Icon";
import Manage from "./views/Manage";
import Settings from "./views/Settings";
import Stats from "./views/Stats";
import TaskGrid from "./views/TaskGrid";
import Today from "./views/Today";
import Todos from "./views/Todos";

const NAV: { view: ViewName; label: string; icon: IconName }[] = [
  { view: "today", label: "今日", icon: "today" },
  { view: "grid", label: "任务表", icon: "grid" },
  { view: "todos", label: "待办", icon: "todo" },
  { view: "manage", label: "任务管理", icon: "manage" },
  { view: "stats", label: "统计", icon: "stats" },
  { view: "settings", label: "设置", icon: "settings" },
];

function renderView(view: ViewName) {
  switch (view) {
    case "today":
      return <Today />;
    case "grid":
      return <TaskGrid />;
    case "todos":
      return <Todos />;
    case "manage":
      return <Manage />;
    case "stats":
      return <Stats />;
    case "settings":
      return <Settings />;
  }
}

export function MainLayout() {
  const view = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);

  return (
    <div className="flex h-full bg-[var(--color-bg)] text-[var(--color-text)]">
      <aside className="flex w-[var(--nav-width)] shrink-0 flex-col gap-0.5 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-3">
        <nav aria-label="主导航" className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.view === view;
            return (
              <button
                key={item.view}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setView(item.view)}
                className={
                  active
                    ? "flex h-9 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--state-selected)] px-2 text-left font-semibold text-[var(--color-voluntary)]"
                    : "flex h-9 items-center gap-2 rounded-[var(--radius-control)] px-2 text-left text-[var(--color-text-muted)] hover:bg-[var(--state-hover)]"
                }
              >
                <Icon name={item.icon} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-2 py-2 text-[var(--text-2xs)] text-[var(--color-text-muted)]">
          v0.1.0 · 本地数据
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        {renderView(view)}
      </section>
    </div>
  );
}
