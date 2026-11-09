import { useEffect } from "react";

import { setLocale } from "./shared/i18n";
import { useSettingsStore } from "./stores/settingsStore";
import { applyTheme, watchSystemTheme } from "./ui/theme";
import { MainLayout } from "./windows/main/MainLayout";
import { useTrayProgress } from "./app/useTrayProgress";
import { useTrayLabels } from "./app/useTrayLabels";
import { useUpdateCheck } from "./app/useUpdateCheck";

export default function App() {
  const theme = useSettingsStore((state) => state.settings.theme);
  const language = useSettingsStore((state) => state.settings.language);

  useTrayProgress();
  useTrayLabels();
  useUpdateCheck();

  useEffect(() => {
    setLocale(language);
  }, [language]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") {
      return;
    }
    return watchSystemTheme(() => applyTheme("system"));
  }, [theme]);

  return <MainLayout />;
}
