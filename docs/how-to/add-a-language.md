# 新增一门语言

> 类型：操作指南
> 状态：稳定
> 适用版本：v0.1.9+
> 相关：reference/i18n.md、reference/conventions.md

适用：给 DailyTask 增加完整 UI 语言（例如日文、繁体中文）。

---

## 1. 新增字典

1. 复制 `src/shared/i18n/en.ts` 为 `src/shared/i18n/<locale>.ts`。
2. 导入 `Messages` 类型并逐项翻译。
3. 漏 key 会被 TypeScript 拦下。

```ts
import type { Messages } from "./zh-CN";

export const ja: Messages = {
  "nav.today": "今日",
  // ...
};
```

## 2. 注册语言

1. `src/domain/types.ts` 扩展 `Language` 和 `ResolvedLanguage`。
2. `src/shared/i18n/index.ts`：

```ts
const locales: Record<ResolvedLanguage, Messages> = {
  "zh-CN": zhCN,
  en,
  ja,
};
```

## 3. 系统语言映射

在 `resolveLanguage` 中增加系统语言前缀判断。例如日文：

```ts
if (systemLanguage.toLowerCase().startsWith("ja")) return "ja";
```

## 4. 设置页

1. `Settings.tsx` 的 `LANGUAGES` 增加选项。
2. 增加 `settings.language.ja` 文案。
3. 选项按钮使用 `data-language-option="ja"`。

## 5. 日期

`dateLocale` 增加该语言对应的 date-fns locale。

## 6. 验证

```bash
npm run typecheck
npm run test
npm run lint
npm run docs:check
```

手动检查：

- 挂件 260px 长文案
- 任务管理表格
- 设置页长 hint
- 托盘菜单

## 7. 文档

在 `reference/i18n.md` 的语言表中登记。
