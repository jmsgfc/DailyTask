import React from "react";
import ReactDOM from "react-dom/client";

import { initApp } from "./app/init";
import App from "./App";
import "./styles.css";

void initApp().catch((error: unknown) => {
  console.error("[init] 数据库初始化失败", error);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
