# DailyTask

[English](./README.md) | [简体中文](./README.zh-CN.md)

本地优先的每日任务打卡与待办桌面应用，用来替代「每改一次习惯就复制一张 Excel 表头」的流程。
Windows 上同时提供纸感悬浮挂件和类似表格的任务网格。

<a id="overview"></a>
## 项目简介

DailyTask 不需要「表头」这个概念，也不会因为调整任务而改动历史记录。每条任务自带一个或多个
**启用区间**；新增、停用、重新启用都只是追加区间数据，过去的数据永不被重写。

应用有两个窗口：

- **悬浮挂件** —— 置顶的纸感卡片，显示今日进度，可直接勾选。
- **主窗口** —— 左侧导航，包含今日、任务表、待办、任务管理、统计、设置。

<a id="status"></a>
## 当前状态

项目处于早期开发阶段。数据层和今日视图已经可用，其余页面仍是占位。尚无正式安装包。

| 模块 | 状态 |
|---|---|
| SQLite 表结构、repository、domain 规则 | 已完成 |
| 今日视图、打卡、进度环、到期待办 | 已完成 |
| 主题 token 与深浅色骨架 | 已完成 |
| UI 文案字典（中文，英文待加） | 已完成 |
| 悬浮挂件 | 计划中（M3） |
| 日期列任务网格 | 计划中（M4） |
| 待办与任务管理界面 | 计划中（M5） |
| 统计、设置、打包、自动更新 | 计划中（M6） |

当前限制：还没有任务创建界面，因此数据库里没有任务时，「今日」会显示空态。
任务管理要到 M5 才提供。

<a id="features"></a>
## 功能特性

已实现：

- **区间式任务** —— 任务可以停用后再启用，历史数据保持完整。
- **今日视图** —— 自愿/被迫分组、进度环、逾期与今天到期的待办，点击即打卡，
  写入采用乐观更新。
- **三种打卡状态** —— 完成、未完成、「今天不做」；后者不计入进度分母。
- **自动结算只做投影** —— 过去的空白格显示为未完成，但不会批量写入数据库。
- **本地 SQLite 存储** —— 无账号、无网络、无同步。
- **分层边界自动化** —— domain、db、stores、views 的依赖方向由 ESLint zone 规则约束。
- **设计 token** —— 颜色、间距、圆角、阴影统一放在 CSS 变量里。

计划中：

- 纸感置顶挂件与跨窗口同步。
- 支持多段区间、缩放、键盘操作、备注、筛选的虚拟化任务网格。
- 待办分组、任务管理、统计、导入导出、备份、托盘菜单、安装包与签名自动更新。

<a id="stack"></a>
## 技术栈

| 层 | 选型 |
|---|---|
| 桌面外壳 | Tauri 2 |
| 界面 | React 19 + TypeScript + Vite 7 |
| 样式 | Tailwind CSS 4 + CSS 变量 |
| 状态 | Zustand 5 |
| 存储 | SQLite（`tauri-plugin-sql`，sqlx migration） |
| 日期 | date-fns 4 |
| 测试 | Vitest 3 + jsdom + Testing Library |
| Lint | ESLint 9 + typescript-eslint + import zone |

<a id="architecture"></a>
## 架构

```text
src/
  app/           启动顺序与数据装载
  domain/        日期、适用性、结算、统计等纯函数
  db/            SQLite 客户端与 repository（唯一允许写 SQL 的层）
  stores/        Zustand store 与 selector
  shared/        类型化跨窗口事件、i18n 字典
  ui/            tokens、CheckCell、ProgressRing、主题工具
  windows/main/  MainLayout 与各视图
src-tauri/
  migrations/    001_init.sql（只增不改）
  capabilities/  SQL / 窗口权限
  src/           Tauri 入口
design/          静态设计稿，不参与构建
docs/            需求、架构、进度文档
```

数据流：`view → store → db → SQLite`。进度、格子状态、streak 等派生值由
`domain/` 和 `stores/selectors/` 现算，不落库。`src/domain` 不依赖 React、Tauri 和数据库。

<a id="data-model"></a>
## 数据模型

共五张表：`tasks`、`task_intervals`、`checkins`、`todos`、`settings`。

- 一条任务可以有多段 `task_intervals`；`end_date = NULL` 表示「至今有效」。
- `checkins` 带 `UNIQUE(task_id, date)`，一个格子只对应一条记录，写入天然幂等。
- 格子投影顺序：不适用 → 已有记录 → 今天/未来待完成 → 过去空白自动结算 → 未完成。
  自动结算只在展示层生效。
- 进度分母 = 适用任务数 − 今天不做，所以「今天不做」不会拉低完成率。

<a id="getting-started"></a>
## 快速开始

环境要求：

- Node.js 22+
- Rust stable（Windows 需要 MSVC 工具链）
- Windows 10/11，带 WebView2
- 对应平台的 Tauri 2 依赖

```bash
npm install
npm run tauri dev
```

首次启动会创建 SQLite 文件：

```text
%APPDATA%\com.dailytask.app\dailytask.db
```

<a id="scripts"></a>
## 常用命令

```bash
npm run tauri dev      # 启动桌面应用
npm run dev            # 只启动前端（Tauri API 不可用）
npm run test           # 运行 Vitest
npm run test:watch     # 监听模式
npm run lint           # ESLint，含依赖 zone 规则
npm run typecheck      # tsc --noEmit
npm run build          # 类型检查 + 前端生产构建
npm run tauri build    # 打包安装包（M6，尚未验证）
```

不启动应用时检查 Rust 侧：

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

<a id="workflow"></a>
## 开发方式

项目按每天 40 分钟推进。`docs/progress.md` 是打卡清单：每个完成的日程都会打勾，
并写一句实际验证结果。只有 lint、test 通过且代码已提交，才算完成一天。

提交信息使用 Conventional Commits，例如：

```text
feat(today): render today view with progress and task groups
fix(db): grant execute permission for SQLite writes
docs(progress): close M2 days D15-D23
```

<a id="i18n"></a>
## 国际化

UI 文案集中在 `src/shared/i18n/zh-CN.ts`，组件通过 `t()` 取文案。新增语言时，
`Messages` 类型会在编译期检查是否漏 key。应用目前只有中文，英文界面在计划中。
仓库的 README 按语言分文件，英文为默认主文件。

<a id="roadmap"></a>
## 里程碑

| 里程碑 | 内容 | 目标日期 |
|---|---|---|
| M1 | 数据层与架构护栏 | 2026-11-14 |
| M2 | 主窗口与今日视图 | 2026-11-26 |
| M3 | 悬浮挂件与跨窗口同步 | 2026-12-07 |
| M4 | 任务表网格 | 2026-12-25 |
| M5 | 待办与任务管理 | 2027-01-05 |
| M6 | 统计、设置、自动更新与发布 | 2027-01-22 |

每日排期见 `docs/progress.md`，验收标准见 `docs/impl.md`。

<a id="docs"></a>
## 文档

- [需求文档](./docs/Requirements.md) —— 产品与交互设计。
- [实施文档](./docs/impl.md) —— 架构、数据模型、风险与里程碑。
- [开发进度](./docs/progress.md) —— 每日排期与打卡清单。
- [设计稿](./design/preview.html) —— 浏览器直接打开，无需构建。
- [设计 token](./design/tokens.css) —— `src/ui/tokens.css` 的来源。

<a id="license"></a>
## 许可证

[MIT](./LICENSE) © 2026 DailyTask contributors。
