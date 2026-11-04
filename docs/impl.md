# DailyTask 实施文档（架构总览）

> 依据：`docs/Requirements.md`（UI / 交互 / 数据模型设计稿）
> 范围：技术选型、目录结构、数据层、窗口方案、核心算法、里程碑与验收标准
> 本文只定架构与接口，不写函数体实现细节

---

## 1. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 外壳 | **Tauri 2** | 双窗口（主窗口 + 悬浮挂件）、置顶、透明、开机自启均为一等能力；安装包约 5–8 MB |
| 前端 | React 19 + TypeScript + Vite | 两套皮肤共用组件与色板 |
| 样式 | Tailwind CSS 4 + CSS 变量 | 变量承载 §7.1 色板，挂件色板/圆角/间距用 token，不引 UI 组件库 |
| 状态 | Zustand 5 | 数据缓存与 UI 状态分离；按窗口各自实例化 |
| 存储 | **SQLite**（`tauri-plugin-sql`，sqlx） | 区间查询、唯一约束、增量迁移都由数据库兜底 |
| 更新 | `tauri-plugin-updater` + GitHub Releases | 静态 `latest.json` 做更新源；签名不可关闭（见 §8 M6） |
| 日期 | date-fns 4 | 仅用其格式化/区间工具，业务日期一律 `YYYY-MM-DD` 字符串 |
| 测试 | Vitest 3 + jsdom | domain 层纯函数优先覆盖，组件只测关键交互 |

依赖清单：

```
前端：@tauri-apps/api  @tauri-apps/plugin-sql  @tauri-apps/plugin-dialog
      @tauri-apps/plugin-fs  @tauri-apps/plugin-updater  @tauri-apps/plugin-process
      zustand  date-fns  clsx
      tailwindcss @tailwindcss/vite  vitest @testing-library/react jsdom
工程：eslint  typescript-eslint  eslint-plugin-import
Rust：tauri 2  tauri-plugin-sql(sqlite)  tauri-plugin-autostart  tauri-plugin-dialog
      tauri-plugin-updater  tauri-plugin-process
```

更新链路：`latest.json` 由发布脚本生成并上传到 GitHub Release，端点固定为
`https://github.com/{owner}/{repo}/releases/latest/download/latest.json`。签名密钥
`TAURI_SIGNING_PRIVATE_KEY` 只存在于本机环境变量，私钥丢失即无法再推送更新。

---

## 2. 目录结构

```
DailyTask/
├─ src-tauri/
│  ├─ src/{main.rs, lib.rs}          # 注册插件、初始化 DB、创建挂件窗口
│  ├─ migrations/001_init.sql        # 建表 + 索引（历史，只读）
│  ├─ migrations/002_checkin_value.sql # 打卡自由值 + recorded 状态
│  ├─ capabilities/default.json      # sql / dialog / fs / window 权限
│  └─ tauri.conf.json                # 两个窗口的尺寸与属性
├─ src/
│  ├─ main.tsx  App.tsx
│  ├─ app/init.ts                     # 启动串行加载：settings → tasks → checkins → todos
│  ├─ shared/events.ts                # 事件名 + payload 类型（唯一允许 import 事件 API 的文件）
│  ├─ shared/i18n/                    # zh-CN 字典 + t()；新增语言只需实现同一 Messages
│  ├─ domain/                        # 纯 TS，无 IO、无 React，100% 可单测
│  │  ├─ types.ts                    # Task / Checkin / Todo / Settings
│  │  ├─ date.ts                     # logicalToday / addDays / range
│  │  ├─ applicability.ts            # isApplicable / applicableTasks
│  │  ├─ settle.ts                   # projectCell / dayProgress
│  │  └─ stats.ts                    # taskStreak / completionRate30
│  ├─ db/
│  │  ├─ client.ts                   # Database.load + migration 校验
│  │  ├─ tasks.ts  checkins.ts  todos.ts  settings.ts
│  │  ├─ backup.ts                   # 每日轮转 + 安装更新前快照
│  │  └─ transfer.ts                 # JSON 导入 / 导出
│  ├─ stores/
│  │  ├─ tasksStore.ts  checkinsStore.ts  todosStore.ts  settingsStore.ts  uiStore.ts
│  │  └─ selectors/{today,grid,stats}.ts   # 跨 store 组合，纯函数
│  ├─ windows/
│  │  ├─ main/                       # 主窗口
│  │  │  ├─ MainLayout.tsx           # 左侧导航 + 右侧内容区
│  │  │  └─ views/{Today,TaskGrid,Todos,Manage,Stats,Settings}.tsx
│  │  └─ widget/                     # 悬浮挂件
│  │     ├─ Widget.tsx
│  │     └─ useWidgetWindow.ts       # 拖拽 / 置顶 / 展开主窗口
│  └─ ui/                            # tokens.css / PaperCard / CheckCell /
│                                    # ProgressRing / DayGroup / EmptyState
├─ docs/{Requirements.md, TODO.md, impl.md, progress.md}
├─ design/                            # 设计稿，不进构建
│  ├─ tokens.css                     # 色板 / 字号 / 间距 / 圆角 / 阴影（src/ui/tokens.css 的来源）
│  └─ preview.html                   # 今日 / 任务表 / 挂件三屏静态稿
└─ package.json  vite.config.ts  vitest.config.ts  eslint.config.js
   scripts/release.mjs               # bump → 签名构建 → gh release → latest.json
```

### 2.1 设计稿（UI 的单一真值）

`design/` 不是构建产物，是写界面前的可视基准，浏览器直接打开，零依赖：

- `tokens.css`：命名按用途不按色值；M2 的 `src/ui/tokens.css` 直接搬，不在组件里另写一套。
- `preview.html`：按真实尺寸画（主窗 1080×720；挂件设计稿为 220×280，实际展开尺寸 260×360，预算见 §5），带假数据、浅深主题与勾选交互，用来验密度而不是看效果图。

已定尺寸（写组件时照此，要改先改这里）：

| 项 | 值 |
|---|---|
| 左导航宽 | 200px |
| 任务行高 / 勾选框 | 34px / 22×22，圆角 6 |
| 内容区 padding | 24 |
| 进度环 | 96px，描边 8 |
| 任务列宽 | 160px（`--task-col-width`） |
| 网格 cellSize | 详细 32 / 概览 16（缩放区间仍 [14, 44]） |

`Requirements.md` §7.1 没给、设计稿被迫补的颜色，已收成命名 token，禁止裸写十六进制：

- `--color-warning`：待办「今天到期」黄
- 挂件不再单独定义纸面色，直接复用主窗 §7.1 的 `--color-surface` / `--color-border` / `--color-text` / `--color-text-muted`

---

## 3. 分层与数据流

```
view ──调用──▶ 领域 store（Zustand）──调用──▶ db/*（SQL）──▶ SQLite 文件
  ▲                        │
  └── selector 组合派生 ◀───┘   domain/*（纯函数，不做 IO）
                               shared/events.ts（跨窗口契约）
```

- **写**：view → store action → db → 成功后更新本 store 内存状态 → emit 对应 `*Changed` 事件。
- **读**：启动时一次性加载全部 tasks / checkins / todos / settings（< 2 万行，约 2 MB），跨年滚动不再查库；超过阈值再退化为按日期范围加载。
- **派生**：今日进度、格子投影状态、streak 全部由 `domain/*` + `stores/selectors/*` 现算，**不落库**。
- **启动顺序**：`app/init.ts` 串行加载 settings → tasks → checkins → todos，全部就绪前不渲染业务视图（否则 `logicalToday` 会读到默认 `dayStartHour`）。
- **跨窗口**：主窗口与挂件是两套独立 WebView，Zustand 不共享，靠 `shared/events.ts` 的类型化事件同步（见 §5）。
- **权限边界**：只有 `db/*` 允许出现 SQL；`domain/*` 不 import 任何 Tauri API，保证可直接单测。

### 3.1 store 划分

| store | 持有 | 允许依赖 |
|---|---|---|
| `useTasksStore` | tasks + intervals、CRUD | `db/tasks`、`domain/applicability` |
| `useCheckinsStore` | 打卡记录（单一 Map，键 `taskId\|date`） | `db/checkins` |
| `useTodosStore` | todos、CRUD | `db/todos` |
| `useSettingsStore` | settings（含 `gridZoom` / `dayStartHour`） | `db/settings` |
| `useUiStore` | 当前视图、筛选、选中格、挂件展开态（不持久化） | 无 |

三条硬约束：

1. **store 之间禁止互相 import**。跨领域派生放在 `stores/selectors/*`，由 hook 组合切片，入参是数据而不是 store 句柄，因此可直接单测：
   ```ts
   export function useTodayData() {
     const tasks = useTasksStore(s => s.tasks);
     const checkins = useCheckinsStore(s => s.byKey);
     const settings = useSettingsStore(s => s.settings);
     return useMemo(() => buildToday(tasks, checkins, settings), [tasks, checkins, settings]);
   }
   ```
2. **`gridZoom` 归 settings，不归 ui**——它是持久化配置，混进 uiStore 会让“UI 状态要不要落库”失去边界。
3. **打卡只存一份**：`Map<"taskId|date", Checkin>`，按行（网格）和按列（今日）都是 O(1)，行列视图由 selector 现建，不维护第二套索引。

同样要守住的边界：**domain 只放日期 / 适用性 / 结算 / 统计四类规则**，实体 CRUD 一律不进 domain，否则“纯函数好测”的优势会被稀释。

### 3.2 依赖护栏（自动化，不靠自觉）

ESLint flat config + `eslint-plugin-import` 的 `no-restricted-paths`，按目录划 zone：

```js
"import/no-restricted-paths": ["error", { zones: [
  { target: "./src/domain",  from: "./src", except: ["./domain"] },
  { target: "./src/ui",      from: "./src", except: ["./ui", "./domain/types"] },
  { target: "./src/db",      from: "./src", except: ["./db", "./domain", "./shared"] },
  { target: "./src/stores",  from: "./src", except: ["./stores", "./db", "./domain", "./shared"] },
  { target: "./src/windows", from: "./src", except: ["./windows", "./stores", "./domain", "./ui", "./shared"] },
]}]
```

配套两条单独规则：

- `windows/**` 禁止直接 import `db/*`（必须过 store，否则 view 能绕过缓存）。
- `@tauri-apps/api/event` 只允许 `shared/events.ts` 引用；`@tauri-apps/plugin-sql` 只允许 `db/*` 引用。

`npm run lint` 纳入 M1 验收，`tauri build` 前先跑 lint + test。zone 依赖 import 解析结果：统一用相对路径，或在 `settings["import/resolver"]` 配好 `typescript` 别名，否则 `@/db/*` 这类写法会绕过规则。暂不引 dependency-cruiser，出现循环依赖再加。

### 3.3 Code review 清单

1. 新派生值落在 `domain/` 或 `stores/selectors/`，而不是 store action 里？
2. store 之间没有互相 import？
3. 没有裸写 `new Date()` 当“今天”，一律走 `logicalToday`？
4. `src/domain/**` 没有 import React / Tauri / db？
5. 事件名取自 `Events` 常量，payload 有类型？
6. view 没有绕过 store 直接调 `db/*`？
7. 写库成功后 emit 了对应 `*Changed` 事件？
8. 停用/启用任务走“追加区间”，没有改历史区间？
9. 样式里的颜色 / 间距 / 圆角取自 `tokens.css`，没有裸写十六进制和魔法数？

---

## 4. 数据层（SQLite）

文件位置：`{AppData}/DailyTask/dailytask.db`。备份分两种，统一放 `backup/`，共保留 7 份：

- **每日轮转**：启动时把上一版复制为 `dailytask-YYYYMMDD.db`；
- **更新前快照**：安装更新前复制为 `pre-update-{version}.db`，写入失败则中止安装。

```sql
CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('voluntary','forced')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 启用区间拆表，支持多段（停用后再启用）
CREATE TABLE task_intervals (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date   TEXT,                        -- NULL = 至今有效
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX idx_intervals_task ON task_intervals(task_id);

CREATE TABLE checkins (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,               -- YYYY-MM-DD
  status     TEXT NOT NULL CHECK (status IN ('done','missed','skipped')),
  note       TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (task_id, date)                  -- 一格一条，upsert 保证幂等
);
CREATE INDEX idx_checkins_date ON checkins(date);

CREATE TABLE todos (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  due_date     TEXT,
  done         INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_todos_due ON todos(done, due_date);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

### 4.1 `002_checkin_value.sql`（打卡自由值）

SQLite 无法放宽既有 `CHECK`，所以重建 `checkins`：加 `value`，状态枚举补 `recorded`。

```sql
CREATE TABLE checkins_new (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('done','missed','skipped','recorded')),
  value      TEXT,          -- 自由值；与 status 相互独立
  note       TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (task_id, date)
);

INSERT INTO checkins_new (id, task_id, date, status, value, note, updated_at)
SELECT id, task_id, date, status, NULL, note, updated_at FROM checkins;

DROP TABLE checkins;
ALTER TABLE checkins_new RENAME TO checkins;
CREATE INDEX idx_checkins_date ON checkins(date);
```

两条写入路径分开，避免互相覆盖：

- `upsertCheckin` 只改 `status` / `note`，**不碰 `value`**；
- `setCheckinValue` 只改 `value`；新建行时状态为 `recorded`，清空值且该行只是 `recorded` 时整行删除。

- 迁移由 `tauri-plugin-sql` 的 `Migration` 数组在 `lib.rs` 注册，版本号只增不改，禁止改历史脚本。
- `settings` 用 kv 存 JSON 值，读写都过 `db/settings.ts` 的类型化包装（默认值集中在 `domain/types.ts` 的 `DEFAULT_SETTINGS`）。
- 日期列建在 `(task_id, date)` 与 `date` 上；统计按任务查整行、今日按日期查整列，两条路径都走索引。
- 导出格式 `JSON v1`：`{ version, exportedAt, tasks, intervals, checkins, todos, settings }`；导入时按 id upsert，不删本地多余数据。

---

## 5. 两个窗口

| | 主窗口 | 悬浮挂件 |
|---|---|---|
| 尺寸 | 默认 1080×720，最小 900×640 | 260×360（含 8px 透明边距），不可缩放 |
| 装饰 | 原生标题栏（M6 再评估自绘） | `decorations:false`、`transparent:true`、圆角 16、CSS 投影 |
| 层级 | 普通窗口 | `alwaysOnTop`、`skipTaskbar`（可配置钉住） |
| 拖拽 | — | `data-tauri-drag-region`，仅标题区可拖 |
| 入口 | `widget:expand` 事件后 `show() + setFocus()` | 默认启动可见，可最小化为托盘 |
| 关闭行为 | 隐藏到托盘/挂件，不退出进程 | 关闭即隐藏，可从托盘唤回 |

挂件尺寸预算（内容区 320px；标题与进度固定，其余滚动）：

| 区块 | 高 |
|---|---|
| 窗口 260×360 − 8px 透明边距 → 卡片 244×344 − padding 12 → 内容 | **320** |
| 标题行（今日 + 日期 + 悬停按钮） | 22 |
| 进度区（环 40 + 完成率 + 自愿/被迫分项） | 50 |
| 滚动区（分组头 20×2 + 任务行 26×N + 待办头 20 + 待办行 26×M） | 240 |

- 展开态与「今日」页同构：标题、完成率、自愿/被迫分项、按类别分组的全部任务（含已完成 / 跳过 / 漏打 / 只记录）、全部今日到期待办（逾期在前）。
- 不再设任务 4 条、待办 2 条上限，也不再显示 `+N`；一屏约 7 行，其余滚动查看，滚动条 4px 半透明。
- 交互只保留「点未完成行 = 完成」「点到期待办 = 完成」；取消完成、跳过、填自由值仍只在主窗口提供（v0.1.3 决策）。
- 外观：卡面、边框、文字沿用主窗 §7.1 色板；保留 16px 圆角、8px 透明边距和中性浮动阴影。日期与正文统一使用系统无衬线，标题加粗。
- **不做系统通知/到期提醒**（本期）：避免 Windows 通知权限、免打扰与点击跳转的额外复杂度，待办只在应用内展示。
- 两窗口共用 `ui/tokens.css`；挂件不再挂纸感主题类，也不生成噪点纹理。
- 托盘菜单：显示主窗口 / 显示挂件 / 今日进度 / 退出。

### 5.1 跨窗口事件契约

事件名和 payload 集中在 `src/shared/events.ts`，其他文件禁止手写事件字符串：

```ts
// 全项目唯一允许 import @tauri-apps/api/event 的文件
export const Events = {
  checkinsChanged: "checkins:changed",
  tasksChanged: "tasks:changed",
  todosChanged: "todos:changed",
  widgetExpand: "widget:expand",
} as const;

export type CheckinsChanged = { date: string; source: "main" | "widget" };
```

- 只导出类型化函数 `emitCheckinsChanged(payload)` / `onCheckinsChanged(fn)`，payload 用 `satisfies` 校验，改名或改字段直接编译报错。
- payload 保持**失效信号**语义：只带 `date` + `source`，不带全量数据，监听方自己重查。
- `source` 由 `getCurrentWindow().label` 推导，监听方丢弃自己发出的事件，避免回环。
- 事件在写库成功之后发送；先改内存再发事件会导致另一窗口读到旧数据。

---

## 6. 核心算法（签名 + 规则）

```ts
// domain/date.ts
logicalToday(now: Date, dayStartHour: number): string   // 04:00 前算前一天

// domain/applicability.ts
isApplicable(intervals: Interval[], date: string): boolean   // 任一区间命中即 true
applicableTasks(tasks: Task[], date: string): Task[]

// domain/settle.ts
type CellState = "done" | "missed" | "skipped" | "recorded" | "pending" | "none";
projectCell(task, date, checkin, settings, today): CellState
dayProgress(tasks, checkins, date, settings, today): { done; missed; skipped; recorded; applicable; ratio }

// domain/stats.ts
taskStreak(task, checkins, today, settings): number       // skipped 不中断、不计数
completionRate30(task, checkins, today, settings): number // 近 30 天完成率
```

统计口径（与 §6 投影规则一致）：

- **分母**只含 `done` + `missed`；`skipped` 与 `recorded` 不计入分母，也不中断 streak。
- `recorded` 是「有值但未判定」：只记录次数 / 时长 / 文本，不改变完成率。
- 关闭自动结算后，过期空白没有结论，同样不进分母。
- 统计窗口固定近 30 天；本期不做热力图与全局折线（理由见 §10）。

`projectCell` 判定顺序：

1. 不在启用区间 → `none`（渲染为 `▫`，不可点）
2. 有打卡记录 → 直接返回记录状态
3. `date >= today` → `pending`（空格，待完成）
4. `date < today` 且 `autoSettleMissed` → `missed`（投影为 `✗`，**不写库**）
5. 其余 → `pending`

**自动结算是展示投影，不是写库。** 避免启动时批量 INSERT 几百行，也避免用户改设置后历史被永久污染；用户点击后才落 `done` / `missed`。

点击循环：`空 → done → missed → 空`（再点一次删除该行记录）。

---

## 7. 任务表网格

- 结构：CSS Grid；左上角为「任务/日期」双冻结角，任务列 `position: sticky; left: 0`（固定 160px，超长名 `text-overflow` 截断），日期行 `sticky; top: 0`。
- 表头两行：月份带 22 + 日期/星期 34。月份文字**固定**在任务列右侧、随滚动换月，不跟着月份第一天滚走（否则滚到月中后月份带是空的）。
- 可见列：内容区 832 − 任务列 160 = 672；详细模式 21 列、概览 42 列。打开时滚到今日，右侧留 3–4 天，`Home` 随时回来。
- 概览模式 16px 色块：✓ 实心绿、✗ 半透明红、▫ 用 `--color-na`、今天不做用灰蓝。
- **只做横向虚拟化**：任务 5–15 行不虚拟化；日期列按 `scrollLeft` 计算可见窗口 ±3 屏，自研约 40 行的 `useHorizontalWindow`（不引 Virtuoso，避免与 sticky 列打架）。
- 缩放：`Ctrl + 滚轮` 改 `cellSize ∈ [14, 44]`（详细模式默认 32，概览模式基准 16），写回 `settings.gridZoom`；`cellSize < 24` 自动切概览模式（单色块按完成率着色，点击跳到详细模式）。
- 行分组：自愿 / 被迫 / 已停用（默认折叠），组头可折叠，`sort_order` 支持拖拽排序。
- 今日列：整列浅色底 + 右边框竖线；`Home` 键回到今日。
- 键盘：`←/→` 切日期，`↑/↓` 切任务，`Space` 循环当前格，`Esc` 取消焦点。
- 日期轴（M4 D36 定）：`start = min(最早区间启用日, today − 365)`，`end = max(today + 30, 最晚区间启用日)`，列数上限 **1200**；超出时只从左侧截断，保证今天和未来 30 天始终在轴内。新用户约 396 列，老用户随历史自然增长。
- 横向虚拟化：只渲染可视窗口 **±2 屏**（±3 屏在 15 行时会突破 2k 格 DOM 预算），左右用 spacer 补齐总宽；表头日期行与任务行共用同一个窗口，所以 `sticky` 角/任务列/表头在虚拟化后仍然成立。
- 1000 列性能目标（D52 验收）：15 个任务下首屏渲染 **< 150 ms**，滚动时无 **> 16.7 ms** 的长任务，同时在 DOM 里的单元格 **≤ 2,000**；200% DPI 下同样成立。
- 拖拽排序（D49）**只允许同组内**调整 `sort_order`，跨组拖拽不生效；改 `category` 必须回任务管理页显式操作，避免误拖改类型。
- 概览模式（D46）点击色块 = 设回详细缩放，并**以该日期为中心**定位；「今天」按钮仍随时回到今日。
- 备注入口（D48）= 悬停 ✓/✗ 格出现 `✎` 再点开气泡；已有备注时格子常驻一个小点，不靠悬停才能发现。

---

## 8. 里程碑与验收

| 阶段 | 内容 | 涉及文件 | 验收标准 |
|---|---|---|---|
| **M1 数据层 + 护栏** | Tauri 脚手架、建表迁移、5 个 repository、domain 纯函数、5 个 store 骨架、ESLint zone 规则 | `migrations/001_init.sql`、`src/db/*`、`src/domain/*`、`src/stores/*`、`eslint.config.js` | `npm run test` 与 `npm run lint` 通过；`isApplicable` 覆盖首尾日 ±1 天、多段区间、`end=null`；`projectCell` 覆盖 today 边界与结算开关；故意写一条反向 import 能被 lint 拦下 |
| **M2 主窗口 + 今日** | 导航骨架、今日视图、进度环、打卡写库 | `MainLayout.tsx`、`ui/tokens.css`、`views/Today.tsx`、`stores/*`、`shared/events.ts` | 勾选后重启应用状态保留；自愿/被迫分组与色值符合 §7.1；"今天不做"与 ✗ 视觉可区分；`useTodayData` 有单测 |
| **M3 悬浮挂件** | 第二窗口、置顶、拖拽、快勾、展开主窗口、跨窗口同步 | `src-tauri/tauri.conf.json`、`windows/widget/*`、`shared/events.ts` | 挂件勾选后主窗口 200 ms 内同步；置顶可开关；展开后主窗口聚焦；事件 payload 有类型且 `source` 去重生效 |
| **M4 任务表** | 网格渲染、区间置灰、缩放两档、键盘、备注气泡、筛选 | `views/TaskGrid.tsx`、`ui/CheckCell.tsx` | 1000 列滚动不掉帧；停用任务历史可见且不可点；`Ctrl+滚轮` 缩放值持久化 |
| **M5 待办 + 任务管理** | 待办分组与 CRUD、任务区间追加 | `views/Todos.tsx`、`views/Manage.tsx` | 逾期天数计算正确；停用后再启用生成第 2 段区间且历史不变；停用日期只能选今天及以后；无截止日归入「以后」 |
| **M6 统计 + 设置 + 发布** | 精简统计、主题、自启、导入导出、备份、托盘、打包、更新器、发布脚本 | `views/Stats.tsx`、`views/Settings.tsx`、`db/transfer.ts`、`db/backup.ts`、`src-tauri/tauri.conf.json`、`scripts/release.mjs` | 统计口径与 §6 一致；导出→清库→导入数据一致；安装版自启生效；**跨版本升级实测**：装 v0.1.0 → 发布 v0.1.1 → 应用内检测并升级成功 → 数据完整 |

依赖关系：M1 → M2 → (M3 与 M4 可并行) → M5 → M6。每个阶段结束跑一次 `npm run lint` + `npm run test` + `npm run tauri build`，防止壳层与架构约束问题积压。

---

## 9. 风险与对策

| 风险 | 对策 |
|---|---|
| Windows 透明窗口无阴影 / 边缘发黑 | 窗口留 8px 内边距，阴影用 CSS `box-shadow` 画在透明画布上；先做 30 行 demo 验证再进 M3 |
| 置顶窗口遮挡全屏应用 / UAC | 置顶做开关，默认开；监听 `focus` 失焦降低透明度（可选） |
| 开机自启只在安装版可用 | M6 用 NSIS 安装包验证，开发模式不验收此项 |
| SQLite 并发写 | 前端串行化所有写操作（store 内队列），单实例锁防止双开 |
| 时区 / 一天的起始时间导致"今天"错位 | 全应用只允许 `logicalToday()` 产出"今天"，禁止直接 `format(new Date())` |
| 迁移脚本改历史 | migration 只追加；CI/测试校验已发布脚本的 hash |
| 更新私钥丢失 = 永久无法推送更新 | 私钥离线保存 + 密码管理器留副本；丢失后只能让用户手动重装（需在 README 写明） |
| Windows 安装更新会强制退出进程 | 安装前先落盘并做 `pre-update-{version}.db` 快照，快照失败则中止安装；挂件勾选写库串行化，避免半写 |
| 公开仓库泄露风险 | 仓库不含密钥、`latest.json` 只放公开签名；签名私钥与 GitHub token 均不进仓库 |

---

## 10. 默认决策（可改）与文档差异

1. 挂件与主窗口**并存**，不互斥。
2. SQL 由前端执行（`tauri-plugin-sql`）+ TS repository，不写 Rust CRUD 命令。
3. 自动结算**仅投影、不写库**（见 §6）。
4. 导出/导入固定为 JSON v1，即使存储已换 SQLite。
5. 仓库**公开**，GitHub Releases 作为更新源；不引入 CI，发布在本机脚本里完成。
6. **更新签名不可关闭**，私钥只存本机环境变量；更新后不支持降级。
7. 统计只做「单任务 streak + 近 30 天完成率」，砍掉热力图、全局折线与自愿/被迫对比（与 `Requirements.md` §4.6 的差异，以此处为准）。
8. 不做系统通知；首次启动为空态引导，不预置示例任务。
9. `Requirements.md` §8 仍写「本地 JSON 默认」，与本文件 §1/§4 冲突；**以本文件为准**，Requirements 待单独修订。
10. （v0.1.3 起）挂件展开态改为**与今日页同构 + 内部滚动**：任务与待办全部渲染，不再设 4 条 / 2 条上限，也不再显示 `+N`；标题与进度固定，中间内容滚动。原「待办上限 2 条」的决策作废，原因见 §5 尺寸预算。
11. **格子只加一个自由值 `value`，不做列模型**：`status` 与 `value` 相互独立，`value` 只记录不判定。这样「每组个数 / 间隔」这类参数可以直接写在格子里，又不会污染完成率；代价是应用不知道值是什么，无法按量统计。
