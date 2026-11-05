import { useSyncExternalStore } from "react";

import { getLocale, subscribe, t } from "../shared/i18n";

/** 当前解析后的语言；system 已解析成 zh-CN / en。 */
export function useLocale() {
  return useSyncExternalStore(subscribe, getLocale);
}

/** 语言变化时重渲染当前组件，返回的 t 与模块级字典同源。 */
export function useT() {
  useLocale();
  return t;
}
