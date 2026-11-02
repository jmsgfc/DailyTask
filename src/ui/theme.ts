import type { Theme } from "../domain/types";

/** 把 light / dark / system 解析成根节点上的 data-theme。 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  if (theme !== "system") {
    root.dataset.theme = theme;
    return;
  }

  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = prefersDark ? "dark" : "light";
}

/** system 主题跟随系统变化，返回取消订阅函数。 */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
