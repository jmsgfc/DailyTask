# ADR 0001：Tauri 2 + SQLite + React

> 类型：解释
> 状态：已接受
> 日期：2026-11-01
> 相关：explanation/architecture.md、reference/data-model.md

## 背景

需要一个仅 Windows 的桌面习惯打卡工具，支持双窗口、透明悬浮、置顶、托盘、自动更新，数据完全本地。

## 决策

- 外壳：Tauri 2
- 前端：React 19 + TypeScript + Vite
- 存储：SQLite（`tauri-plugin-sql` / sqlx）
- 状态：Zustand
- 更新：`tauri-plugin-updater` + GitHub Releases

## 理由

- 安装包小，系统 WebView，不需要 Electron 体积
- SQLite 的 UNIQUE / 索引 / 迁移适合打卡数据
- 双窗口、透明、置顶、托盘、自启都是一等能力

## 代价

- WebView2 行为受 Windows 影响
- Rust + TS 双栈
- 透明窗口与 DPI 需要真机验证

## 被否方案

- Electron：包体大，内存高
- 纯 Web：无法做透明置顶挂件与托盘
- 本地 JSON：并发、查询、迁移都更弱
