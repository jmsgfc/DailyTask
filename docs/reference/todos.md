# 待办参考

> 类型：参考
> 状态：稳定
> 适用版本：v0.1.9+
> 相关：reference/data-model.md、how-to/manage-todos.md

---

## 1. Todo

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | UUID |
| `title` | string | 必填 |
| `dueDate` | `YYYY-MM-DD \| null` | null 归入「以后」 |
| `done` | boolean | |
| `completedAt` | ISO string \| null | |
| `createdAt` | ISO string | |
| `updatedAt` | ISO string | |

## 2. 分组

| 分组 | 条件 |
|---|---|
| 逾期 | `dueDate < today && !done` |
| 今天 | `dueDate = today && !done` |
| 本周 | `today < dueDate ≤ 本周日 && !done` |
| 以后 | `dueDate = null` 或 `dueDate > 本周日`，且 `!done` |
| 已完成 | `done = true`，默认折叠 |

本周以周一为一周开始，周日为界。

## 3. 逾期天数

```ts
diffDays(today, dueDate)
```

按日历天，不含时间。

## 4. 操作

- 新增：标题必填；截止日期可空
- 完成 / 取消完成：行内圆圈
- 重命名：`✎`，Enter/失焦保存，Esc 取消
- 改日期：日历按钮或右键菜单
- 删除：二次确认
- 右键：改日期、清除日期、删除

## 5. 排序

- 组内按 `dueDate` 升序
- 已完成组按完成时间/创建时间
