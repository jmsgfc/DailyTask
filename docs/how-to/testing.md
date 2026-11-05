# 测试

> 类型：操作指南
> 状态：稳定
> 适用版本：v0.1.9+
> 相关：tutorials/local-development.md、reference/domain-functions.md、reference/data-model.md

---

## 1. 测试分层

| 层 | 位置 | 重点 |
|---|---|---|
| 纯函数 | `src/domain/*.test.ts` | 日期、适用性、投影、统计边界 |
| 数据层 | `src/db/*.test.ts` | 真实 SQLite、upsert、迁移、导入导出 |
| store | `src/stores/*.test.ts` | 乐观更新、回滚、事件 |
| 组件 | `src/windows/**/*.test.tsx`、`src/ui/*.test.tsx` | 关键交互与文案 |
| 应用 | `src/App.test.tsx`、`src/app/*.test.tsx` | 启动、同步、托盘、更新 |

## 2. 真实 SQLite

迁移与约束测试不要 mock：

```ts
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(readFileSync("src-tauri/migrations/001_init.sql", "utf8"));
// ...
```

参考：

- `src/db/intervals.test.ts`
- `src/db/checkins.test.ts`
- `src/db/transfer.test.ts`
- `src/app/restart.test.ts`

迁移测试至少覆盖：

- 迁移前插入旧状态
- 执行迁移
- 断言状态、value、note、id 保留

## 3. 夹具

- 任务：`task(id, name, category, start, end, order)`
- 打卡：`checkin(taskId, date, status)`
- 设置：`DEFAULT_SETTINGS`
- 日期固定：`vi.setSystemTime(new Date(...))`

不要依赖真实当前时间；所有跨日/跨月用例固定系统时间。

## 4. 组件测试

- 用 role / aria-label 查询，不绑 DOM 结构
- 异步删除/保存用 `await act(async () => undefined)`
- 弹窗通过 portal 渲染时用 `screen`，不要用 `container.querySelector`
- 语言测试后恢复 `setLocale("zh-CN")`
- 测试环境 `navigator.language` 固定 `zh-CN`

## 5. 提交前

```bash
npm run test
npm run lint
npm run typecheck
cargo check
```

UI 改动还应：

```bash
npm run dev:app
```

手动检查中文 / English、200% DPI、挂件 260px。

## 6. 常见缺口

- 只测 mock，不测真实 SQLite
- 只测中文，不测英文长文案
- 删除只测成功，不测失败保留弹窗
- 迁移只测新库，不测旧数据升级
- 时区 / `logicalToday` 边界缺失
