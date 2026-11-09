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
| `renderer` | 一个窗口一个渲染进程 | **可以**：挂件窗口按需创建 |
| `crashpad-handler` | 崩溃上报 | 否 |

进程数取决于窗口数：主窗 + 挂件同时存在时是 8 个，挂件未创建时是 7 个。

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

- **挂件窗口**：不显示时不创建、隐藏后销毁，省一个 renderer，并从 8 个进程降到 7 个。
- **前端首包**：视图按需加载，减少启动时解析的模块与堆占用。

不优化（属于 WebView2 固定成本）：

- `browser` / `network` / `storage` / `crashpad` 四个进程。
- `gpu-process`：与窗口数量、系统缩放、透明挂件合成相关；关闭 GPU 会换到软件渲染，CPU 上升且透明圆角可能失真，不采用。
- 主窗 renderer：主窗隐藏到托盘时 Tauri 不销毁 webview，renderer 继续驻留。

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

## 5. 挂件可见性

挂件的显示状态保存在应用数据目录的 `widget-visible` 文件：

```text
1  上次可见，下次启动创建挂件
0  上次隐藏，下次启动不创建挂件
```

- 文件缺失、不可读或内容异常时按 `1` 处理，保证首次启动与旧版本行为一致。
- 托盘「显示 / 隐藏挂件」与左键唤回都会更新该文件。
- 挂件隐藏时窗口被销毁，再次显示时按 `tauri.conf.json` 里的 `widget` 配置重建，胶囊态与停靠侧仍从 `localStorage` 恢复。

## 6. 预期效果

同一台机器、冷启动 20 秒后采样：

| 场景 | 优化前（v0.1.12） | 优化后 |
|---|---|---|
| 挂件显示 | 8 进程 / 144.6 MB | 8 进程 / 142.5 MB |
| 挂件隐藏 | 不支持（挂件总在） | **7 进程 / 122.4 MB** |
| 挂件隐藏 + 主窗隐藏到托盘 | 8 进程 | 7 进程（主窗 renderer 仍驻留） |

挂件常驻的用户只拿到约 2 MB 的收益，主要来自视图按需加载；真正的收益（1 个进程、约 22 MB）来自主动隐藏挂件。
