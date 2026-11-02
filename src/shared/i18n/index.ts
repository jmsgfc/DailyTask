import type { Locale as DateFnsLocale } from "date-fns";
import { enUS, zhCN as dateFnsZhCN } from "date-fns/locale";

import type { Language } from "../../domain/types";
import { zhCN, type MessageKey, type Messages } from "./zh-CN";

export type { MessageKey };

/** 新增语言时在这里注册；缺 key 会被 Messages 类型拦下。 */
const locales: Partial<Record<Language, Messages>> = {
  "zh-CN": zhCN,
};

let current: Language = "zh-CN";
let messages: Messages = zhCN;
const listeners = new Set<() => void>();

export function getLocale(): Language {
  return current;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 切换语言。尚未注册的语言保持原样，避免设置里误存 "en" 时白屏。
 */
export function setLocale(next: Language): void {
  const nextMessages = locales[next];
  if (!nextMessages) {
    return;
  }
  current = next;
  messages = nextMessages;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
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
  return language === "en" ? enUS : dateFnsZhCN;
}
