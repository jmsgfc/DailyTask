# DailyTask 架构总览（入口）

> 状态：稳定
> 适用版本：v0.1.8+
> 相关：docs/README.md

本文件只保留架构入口与关键约束，详细内容已拆分到 `docs/architecture/`。

---

## 1. 先读哪篇

| 想了解 | 文档 |
|---|---|
| 技术栈、目录、分层、依赖护栏 | [architecture/overview.md](architecture/overview.md) |
| SQLite 表结构、迁移、导入导出、备份 | [architecture/data.md](architecture/data.md) |
| 区间、投影、自动结算、streak、完成率 | [architecture/domain.md](architecture/domain.md) |
| 主窗、挂件、托盘、跨窗口事件 | [architecture/windows.md](architecture/windows.md) |
| 任务表网格、虚拟化、缩放、筛选 | [architecture/grid.md](architecture/grid.md) |
| 中英文、system 解析、托盘文案 | [architecture/i18n.md](architecture/i18n.md) |
| 开发环境、测试、约定、调试 | [development/setup.md](development/setup.md) |
| 发版、升级回退、备份、排障 | [operations/release.md](operations/release.md) |
| 产品需求与口径 | [product/requirements.md](product/requirements.md) |
| 当前迭代进度 | [project/progress.md](project/progress.md) |
| 术语 | [glossary.md](glossary.md) |

## 2. 架构一句话

```text
view → Zustand store → db repository → SQLite
         ↑
    domain 纯函数 + selectors
```

- 只有 `db/*` 出现 SQL
- `domain/*` 无 IO / React / Tauri
- store 之间不互相 import
- 跨窗口用 `shared/events.ts` 的失效信号同步
- 删除必须走 `ConfirmDeleteButton` + `DeleteConfirmation` 令牌

## 3. 数据与状态

- 打卡三状态：`done / missed / skipped`
- `value` 是附加字段，不是状态；没有判定时写值自动记为 `done`
- 自动结算只投影，不写库
- 进度分母 = `applicable − skipped`
- 每 N 天任务以区间启用日为锚点，每段独立

详见 [domain.md](architecture/domain.md)。

## 4. 里程碑与验收

| 阶段 | 内容 | 验收 |
|---|---|---|
| M1 | 数据层 + 护栏 | 测试 / lint 通过，反向 import 被拦 |
| M2 | 主窗口 + 今日 | 重启保留打卡，跳过与未完成可辨 |
| M3 | 悬浮挂件 + 同步 | 200ms 内跨窗口同步，置顶可开关 |
| M4 | 任务表网格 | 1000 列不卡，停用历史不可点 |
| M5 | 待办 + 任务管理 | 区间追加不改历史 |
| M6 | 统计 + 设置 + 发布 | 导出导入一致，跨版本升级实测 |

详细风险与默认决策见 [operations/release.md](operations/release.md) 与 [product/decisions.md](product/decisions.md)。
d)。
