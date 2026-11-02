import { useEffect } from "react";

import { useSettingsStore } from "./stores/settingsStore";
import { applyTheme, watchSystemTheme } from "./ui/theme";
import { MainLayout } from "./windows/main/MainLayout";

export default function App() {
  const theme = useSettingsStore((state) => state.settings.theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") {
      return;
    }
    return watchSystemTheme(() => applyTheme("system"));
  }, [theme]);

  return <MainLayout />;
}
