import { useSyncExternalStore } from "react";

import { getLocale, subscribe, t } from "../shared/i18n";

/** 语言变化时重渲染当前组件，返回的 t 与模块级字典同源。 */
export function useT() {
  useSyncExternalStore(subscribe, getLocale);
  return t;
}
