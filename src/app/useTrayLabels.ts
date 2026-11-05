import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";

import { t } from "../shared/i18n";
import { useLocale } from "../ui/useT";

/** 托盘菜单的静态文案跟当前语言走；语言切换后重新下发。 */
export function useTrayLabels(): void {
  const locale = useLocale();

  useEffect(() => {
    void invoke("set_tray_labels", {
      showMain: t("tray.showMain"),
      hideMain: t("tray.hideMain"),
      showWidget: t("tray.showWidget"),
      hideWidget: t("tray.hideWidget"),
      quit: t("tray.quit"),
    }).catch((error: unknown) => {
      console.error("[tray] 更新菜单文案失败", error);
    });
  }, [locale]);
}
