# 内存与进程

> 类型：参考
> 状态：稳定
> 适用版本：v0.1.13+
> 相关：windows-and-tray.md、conventions.md、file-locations.md

本文记录 DailyTask 的进程构成、实测内存基线，以及哪些开销可以优化、哪些是 WebView2 固定成本。

---

## 1. 进程模型

一个运行中的 DailyTask 由 **1 个 Rust 主进程 + 7 个 WebView2 进程**组成：

| 进程 | 角色 | 能否去掉 |
|---|---|---|
| `dailytask.exe` | Rust 主进程、托盘、窗口管理 | 否 |
| `browser` | WebView2 浏览器进程 | 否 |
| `gpu-process` | GPU 与合成 | 否（受 `--disable-gpu` 影响，未采用） |
| `network.mojom.NetworkService` | 网络服务 | 否 |
| `storage.mojom.StorageService` | 存储服务 | 否 |
| `renderer` | 一个窗口一个渲染进程 | **可以**：主窗、挂件都按需创建 |
| `crashpad-handler` | 崩溃上报 | 否 |

进程数取决于窗口数：主窗 + 挂件同时存在时是 8 个，只留一个窗口是 7 个；两个窗口都销毁后，WebView2 会连 browser / gpu / network / storage / crashpad 一起退出，只剩 1 个 Rust 进程。

## 2. 实测基线

环境：Windows、DailyTask v0.1.12、WebView2 157、主窗 + 挂件同时显示、冷启动后 20 秒采样。

| 进程 | 角色 | 私有工作集 |
|---|---|---|
| `gpu-process` | GPU | 51.7 MB |
| `browser` | 浏览器 | 29.5 MB |
| `renderer` | 主窗口 | 28.7 MB |
| `renderer` | 挂件窗口 | 16.0 MB |
| `network` | 网络服务 | 7.2 MB |
| `dailytask.exe` | 主进程 | 6.8 MB |
| `storage` | 存储服务 | 3.1 MB |
| `crashpad` | 崩溃上报 | 1.6 MB |

合计 **8 个进程 / 144.6 MB**。任务管理器显示的是私有工作集，工作集列会明显更大。

## 3. 可优化与不可优化

可以优化：

- **主窗窗口**：隐藏即销毁，唤起时重建；省一个 renderer。
- **挂件窗口**：不显示时不创建、隐藏后销毁，省一个 renderer。
- **前端首包**：视图按需加载，减少启动时解析的模块与堆占用。

不优化（属于 WebView2 固定成本）：

- `browser` / `network` / `storage` / `crashpad` 四个进程。
- `gpu-process`：与窗口数量、系统缩放、透明挂件合成相关；关闭 GPU 会换到软件渲染，CPU 上升且透明圆角可能失真，不采用。
- 没有窗口时会话整体退出：点 X 或从托盘隐藏后，窗口被销毁，WebView2 进程随之全部退出，只剩 Rust 主进程（约 5 MB）。

以下手段经过评估但未采用：

| 手段 | 未采用原因 |
|---|---|
| `--process-per-site` | 两窗共用渲染进程，任一窗口卡死会连带另一窗口 |
| `--disable-gpu` | CPU 上升，透明挂件可能失真 |
| `--enable-low-end-device-mode` | 收益不稳定，需逐版本回归 |

## 4. 测量方法

```bash
npm run perf:memory
npm run perf:memory -- -Samples 10 -IntervalSec 30
```

脚本遍历 `dailytask.exe` 的进程树，按命令行识别角色，输出私有工作集并合计。

三个基准场景：

| 场景 | 操作 |
|---|---|
| 冷启动 | 启动后等 30 秒再采样 |
| 空闲 | 显示主窗，静置 10 分钟再采样 |
| 托盘隐藏 | 主窗与挂件都隐藏，等 3 分钟再采样 |

对比优化前后时，三个场景都要采，不能只看冷启动。

## 5. 窗口生命周期

主窗和挂件都不常驻：

| 事件 | 行为 |
|---|---|
| 点 X / 托盘隐藏主窗 | 记住位置、大小、最大化 → `destroy()` |
| 托盘显示主窗 / 单实例 / 挂件展开 | `from_config` 重建 → 恢复几何 → `show` + 聚焦 |
| 托盘隐藏挂件 | `destroy()`，写 `widget-visible=0` |
| 托盘显示挂件 | 重建，写 `widget-visible=1` |

- 几何只存在进程内存，应用退出后回到 `tauri.conf.json` 的默认值。
- 主窗重建后回到上次停留的页面（`localStorage` 里的 view），滚动位置不保留。
- 更新检查按 `localStorage` 时间戳节流（1 小时），避免每次唤回都发请求。
- 两个窗口都销毁后 Tauri 会请求退出，Rust 侧用 `RunEvent::ExitRequested` 拦下，
  托盘继续存活；托盘「退出」走 `app.exit(0)`，不拦截。
- 托盘进度在无窗口时停在最后一次数字；挂件可见时由挂件继续更新。

## 6. 挂件可见性

挂件的显示状态保存在应用数据目录的 `widget-visible` 文件：

```text
1  上次可见，下次启动创建挂件
0  上次隐藏，下次启动不创建挂件
```

- 文件缺失、不可读或内容异常时按 `1` 处理，保证首次启动与旧版本行为一致。
- 托盘「显示 / 隐藏挂件」与左键唤回都会更新该文件。
- 挂件隐藏时窗口被销毁，再次显示时按 `tauri.conf.json` 里的 `widget` 配置重建，并按启动规则回到胶囊态，停靠侧沿用 `localStorage`。

## 7. 预期效果

同一台机器、冷启动 20 秒后采样：

| 场景 | 优化前（v0.1.12） | 优化后 |
|---|---|---|
| 主窗 + 挂件都显示 | 8 进程 / 144.6 MB | 8 进程 / 134.4 MB |
| 只隐藏挂件 | 不支持（挂件总在） | 7 进程 / 123.1 MB |
| 两窗都销毁 | 8 进程 / 144.6 MB | **1 进程 / 5.2 MB** |
| 从托盘唤回两个窗口 | — | 8 进程 / 136.7 MB |

唤回是冷启动：WebView2 进程树要重新拉起，实测 0.7 秒后两个 renderer 就绪。

挂件常驻的用户拿到约 10 MB 的收益（视图按需加载 + 主窗销毁后挂件承担托盘进度）；只有把主窗也关掉，空闲内存才会降到单个 Rust 进程的水平。
