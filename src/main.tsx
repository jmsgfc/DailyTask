import React from "react";
import ReactDOM from "react-dom/client";

import { initApp, type AppData } from "./app/init";
import App from "./App";
import { useCheckinsStore } from "./stores/checkinsStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useTasksStore } from "./stores/tasksStore";
import { useTodosStore } from "./stores/todosStore";
import "./styles.css";

function hydrate(data: AppData): void {
  useSettingsStore.getState().hydrate(data.settings);
  useTasksStore.getState().hydrate(data.tasks);
  useCheckinsStore.getState().hydrate(data.checkins);
  useTodosStore.getState().hydrate(data.todos);
}

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

root.render(
  <main className="flex h-full items-center justify-center text-sm text-stone-500">
    正在加载…
  </main>,
);

void initApp()
  .then((data) => {
    hydrate(data);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error("[init] 初始化失败", error);
    root.render(
      <main className="flex h-full flex-col items-center justify-center gap-2 text-sm text-red-600">
        <p>初始化失败，请重启应用。</p>
        <p className="text-stone-500">详情见开发者工具控制台。</p>
      </main>,
    );
  });
