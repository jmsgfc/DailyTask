export type WindowTarget = "main" | "widget";

/** 两个窗口共用同一份 index.html，用查询参数区分渲染入口。 */
export function windowTarget(search: string): WindowTarget {
  return new URLSearchParams(search).get("window") === "widget"
    ? "widget"
    : "main";
}
