import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useEffect, useState, type ReactNode } from "react";

import type { Theme } from "../../../domain/types";
import { useSettingsStore } from "../../../stores/settingsStore";
import { applyTheme } from "../../../ui/theme";
import { useT } from "../../../ui/useT";

const CARD =
  "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

const THEMES: Theme[] = ["system", "light", "dark"];
const DAY_START_OPTIONS = Array.from({ length: 13 }, (_, hour) => hour);

export default function Settings() {
  const t = useT();
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);

  const [autoLaunch, setAutoLaunch] = useState(settings.autoLaunch);
  const [autoLaunchReady, setAutoLaunchReady] = useState(true);

  // 自启状态以系统为准：设置表只是缓存。
  useEffect(() => {
    let cancelled = false;
    void isEnabled()
      .then((enabled) => {
        if (!cancelled) {
          setAutoLaunch(enabled);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAutoLaunchReady(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = (next: Theme) => {
    applyTheme(next);
    void update({ theme: next }).catch((error: unknown) => {
      console.error("[settings] 保存主题失败", error);
    });
  };

  const toggleAutoLaunch = () => {
    const next = !autoLaunch;
    setAutoLaunch(next);
    void (async () => {
      try {
        if (next) {
          await enable();
        } else {
          await disable();
        }
        await update({ autoLaunch: next });
      } catch (error) {
        setAutoLaunch(!next);
        console.error("[settings] 切换开机自启失败", error);
      }
    })();
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
                  aria-pressed={settings.theme === option}
                  onClick={() => setTheme(option)}
                  className={
                    settings.theme === option
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

        <section data-settings-section="behavior" className={`${CARD} p-4`}>
          <h2 className="m-0 mb-3 text-xs font-semibold text-[var(--color-text-muted)]">
            {t("settings.section.behavior")}
          </h2>

          <SettingRow
            label={t("settings.autoSettle")}
            hint={t("settings.autoSettleHint")}
          >
            <Switch
              setting="auto-settle"
              label={t("settings.autoSettle")}
              checked={settings.autoSettleMissed}
              onChange={(next) =>
                void update({ autoSettleMissed: next }).catch(
                  (error: unknown) => {
                    console.error("[settings] 保存自动结算失败", error);
                  },
                )
              }
            />
          </SettingRow>

          <SettingRow
            label={t("settings.dayStart")}
            hint={t("settings.dayStartHint")}
          >
            <select
              data-setting="day-start"
              aria-label={t("settings.dayStart")}
              value={settings.dayStartHour}
              onChange={(event) =>
                void update({
                  dayStartHour: Number(event.target.value),
                }).catch((error: unknown) => {
                  console.error("[settings] 保存起始时间失败", error);
                })
              }
              className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-text)]"
            >
              {DAY_START_OPTIONS.map((hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </SettingRow>
        </section>

        <section data-settings-section="window" className={`${CARD} p-4`}>
          <h2 className="m-0 mb-3 text-xs font-semibold text-[var(--color-text-muted)]">
            {t("settings.section.window")}
          </h2>

          <SettingRow label={t("settings.alwaysOnTop")}>
            <Switch
              setting="always-on-top"
              label={t("settings.alwaysOnTop")}
              checked={settings.alwaysOnTop}
              onChange={(next) =>
                void update({ alwaysOnTop: next }).catch((error: unknown) => {
                  console.error("[settings] 保存置顶设置失败", error);
                })
              }
            />
          </SettingRow>

          <SettingRow
            label={t("settings.autoLaunch")}
            hint={
              autoLaunchReady
                ? t("settings.autoLaunchHint")
                : t("settings.autoLaunchUnavailable")
            }
          >
            <Switch
              setting="auto-launch"
              label={t("settings.autoLaunch")}
              checked={autoLaunch}
              disabled={!autoLaunchReady}
              onChange={toggleAutoLaunch}
            />
          </SettingRow>
        </section>

        <p className="mt-auto text-[var(--text-2xs)] text-[var(--color-text-muted)]">
          {t("settings.version", { version: "0.1.0" })}
        </p>
      </div>
    </>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 py-1.5">
      <div className="flex w-[240px] shrink-0 flex-col">
        <span className="text-sm">{label}</span>
        {hint ? (
          <span className="text-[var(--text-2xs)] text-[var(--color-text-muted)]">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Switch({
  setting,
  label,
  checked,
  disabled,
  onChange,
}: {
  setting: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      data-setting={setting}
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-[var(--radius-pill)] transition-colors disabled:opacity-40 ${
        checked ? "bg-[var(--color-voluntary)]" : "bg-[var(--color-border-strong)]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left] ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
