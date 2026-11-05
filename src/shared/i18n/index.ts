import type { Locale as DateFnsLocale } from "date-fns";
import { enUS, zhCN as dateFnsZhCN } from "date-fns/locale";

import type { Language, ResolvedLanguage } from "../../domain/types";
import { en } from "./en";
import { zhCN, type MessageKey, type Messages } from "./zh-CN";

export type { MessageKey };
export type { ResolvedLanguage };

/** 新增语言时在这里注册；缺 key 会被 Messages 类型拦下。 */
const locales: Record<ResolvedLanguage, Messages> = {
  "zh-CN": zhCN,
  en,
};

let current: ResolvedLanguage = "zh-CN";
let messages: Messages = zhCN;
const listeners = new Set<() => void>();

/** system 跟随系统语言；当前只有 zh-CN / en 两套字典，其余语言回退中文。 */
export function resolveLanguage(
  language: Language,
  systemLanguage = typeof navigator === "undefined"
    ? "zh-CN"
    : navigator.language,
): ResolvedLanguage {
  if (language !== "system") {
    return language;
  }
  return systemLanguage.toLowerCase().startsWith("en") ? "en" : "zh-CN";
}

export function getLocale(): ResolvedLanguage {
  return current;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLocale(next: Language): void {
  const resolved = resolveLanguage(next);
  current = resolved;
  messages = locales[resolved];
  if (typeof document !== "undefined") {
    document.documentElement.lang = resolved;
  }
  listeners.forEach((listener) => listener());
}

export function t(
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = messages[key] ?? zhCN[key] ?? key;
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** date-fns 的 locale 跟语言设置对齐，日期文案不单独维护。 */
export function dateLocale(language: Language): DateFnsLocale {
  return resolveLanguage(language) === "en" ? enUS : dateFnsZhCN;
}
