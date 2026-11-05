import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";

import { logicalToday } from "../domain/date";
import { dayProgress } from "../domain/settle";
import { useCheckinsStore } from "../stores/checkinsStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useTasksStore } from "../stores/tasksStore";
import { useLocale, useT } from "../ui/useT";

/** 把今日进度写进托盘菜单；主窗口隐藏时也能跟着打卡更新。 */
export function useTrayProgress(): void {
  const tasks = useTasksStore((state) => state.tasks);
  const checkins = useCheckinsStore((state) => state.byKey);
  const settings = useSettingsStore((state) => state.settings);
  const t = useT();
  const locale = useLocale();

  const today = logicalToday(new Date(), settings.dayStartHour);
  const progress = dayProgress(tasks, checkins, today, settings, today);
  const total = progress.applicable - progress.skipped;
  const done = progress.done;

  useEffect(() => {
    void invoke("set_tray_progress", {
      text: t("tray.progress", { done, total }),
    }).catch((error: unknown) => {
      console.error("[tray] 更新进度失败", error);
    });
  }, [done, total, locale, t]);
}
