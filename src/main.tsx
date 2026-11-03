import React from "react";
import ReactDOM from "react-dom/client";

import { initApp, type AppData } from "./app/init";
import { startCrossWindowSync } from "./app/sync";
import App from "./App";
import { useCheckinsStore } from "./stores/checkinsStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useTasksStore } from "./stores/tasksStore";
import { setLocale, t } from "./shared/i18n";
import { useTodosStore } from "./stores/todosStore";
import { applyTheme } from "./ui/theme";
import { windowTarget } from "./windows/windowTarget";
import { Widget } from "./windows/widget/Widget";
import "./styles.css";

function hydrate(data: AppData): void {
  useSettingsStore.getState().hydrate(data.settings);
  useTasksStore.getState().hydrate(data.tasks);
  useCheckinsStore.getState().hydrate(data.checkins);
  useTodosStore.getState().hydrate(data.todos);
}

const target = windowTarget(window.location.search);
if (target === "widget") {
  document.documentElement.dataset.window = "widget";
}

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

root.render(
  <main className="flex h-full items-center justify-center text-sm text-stone-500">
    {t("app.loading")}
  </main>,
);

void initApp()
  .then((data) => {
    hydrate(data);
    setLocale(data.settings.language);
    applyTheme(data.settings.theme);
    void startCrossWindowSync().catch((error: unknown) => {
      console.error("[sync] 跨窗口同步启动失败", error);
    });
    root.render(
      <React.StrictMode>
        {target === "widget" ? <Widget /> : <App />}
      </React.StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error("[init] 初始化失败", error);
    root.render(
      <main className="flex h-full flex-col items-center justify-center gap-2 text-sm text-red-600">
        <p>{t("app.initFailed")}</p>
        <p className="text-stone-500">{t("app.initFailedHint")}</p>
      </main>,
    );
  });
