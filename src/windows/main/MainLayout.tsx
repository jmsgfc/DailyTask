import type { MessageKey } from "../../shared/i18n";
import { useUiStore, type ViewName } from "../../stores/uiStore";
import { useUpdateStore } from "../../stores/updateStore";
import { Icon, type IconName } from "../../ui/Icon";
import { useT } from "../../ui/useT";
import Manage from "./views/Manage";
import Settings from "./views/Settings";
import Stats from "./views/Stats";
import TaskGrid from "./views/TaskGrid";
import Today from "./views/Today";
import Todos from "./views/Todos";

const NAV: { view: ViewName; labelKey: MessageKey; icon: IconName }[] = [
  { view: "today", labelKey: "nav.today", icon: "today" },
  { view: "grid", labelKey: "nav.grid", icon: "grid" },
  { view: "todos", labelKey: "nav.todos", icon: "todo" },
  { view: "manage", labelKey: "nav.manage", icon: "manage" },
  { view: "stats", labelKey: "nav.stats", icon: "stats" },
  { view: "settings", labelKey: "nav.settings", icon: "settings" },
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
  const t = useT();
  const view = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);
  const hasUpdate = useUpdateStore((state) => state.available !== null);

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
                {t(item.labelKey)}
                {item.view === "settings" && hasUpdate ? (
                  <span
                    data-update-dot
                    aria-label={t("update.dot")}
                    className="ml-auto size-1.5 shrink-0 rounded-full bg-[var(--color-missed)]"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-2 py-2 text-[var(--text-2xs)] text-[var(--color-text-muted)]">
          {t("app.footer", { version: __APP_VERSION__ })}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        {renderView(view)}
      </section>
    </div>
  );
}
