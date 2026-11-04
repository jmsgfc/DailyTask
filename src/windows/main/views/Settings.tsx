import { applyTheme } from "../../../ui/theme";
import type { Theme } from "../../../domain/types";
import { useSettingsStore } from "../../../stores/settingsStore";
import { useT } from "../../../ui/useT";

const CARD =
  "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

const THEMES: Theme[] = ["system", "light", "dark"];

export default function Settings() {
  const t = useT();
  const theme = useSettingsStore((state) => state.settings.theme);
  const update = useSettingsStore((state) => state.update);

  const setTheme = (next: Theme) => {
    applyTheme(next);
    void update({ theme: next }).catch((error: unknown) => {
      console.error("[settings] 保存主题失败", error);
    });
  };

  return (
    <>
      <header className="flex items-baseline gap-3">
        <h1 className="m-0 text-[var(--text-lg)] font-semibold tracking-[.2px]">
          {t("settings.title")}
        </h1>
        <span className="text-sm text-[var(--color-text-muted)]">
          {t("settings.subtitle")}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <section data-settings-section="appearance" className={`${CARD} p-4`}>
          <h2 className="m-0 mb-3 text-xs font-semibold text-[var(--color-text-muted)]">
            {t("settings.section.appearance")}
          </h2>
          <div className="flex items-center gap-4">
            <span className="w-[120px] shrink-0 text-sm">
              {t("settings.theme")}
            </span>
            <div
              role="group"
              aria-label={t("settings.theme")}
              className="flex gap-0.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5"
            >
              {THEMES.map((option) => (
                <button
                  key={option}
                  type="button"
                  data-theme-option={option}
                  aria-pressed={theme === option}
                  onClick={() => setTheme(option)}
                  className={
                    theme === option
                      ? "rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-text)] shadow-[0_1px_2px_rgba(0,0,0,.06)]"
                      : "rounded-[var(--radius-pill)] px-3 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--state-hover)]"
                  }
                >
                  {t(
                    option === "system"
                      ? "settings.theme.system"
                      : option === "light"
                        ? "settings.theme.light"
                        : "settings.theme.dark",
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        <p className="mt-auto text-[var(--text-2xs)] text-[var(--color-text-muted)]">
          {t("settings.version", { version: "0.1.0" })}
        </p>
      </div>
    </>
  );
}
