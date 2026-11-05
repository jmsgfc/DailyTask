# 开发环境

> 状态：稳定
> 适用版本：v0.1.8+
> 相关：development/testing.md、development/debugging.md

---

## 1. 前置

| 依赖 | 版本 |
|---|---|
| Node.js | 22+ |
| npm | 10+ |
| Rust | stable + MSVC toolchain |
| WebView2 | Windows 10/11 自带 |
| Tauri CLI | 随 `@tauri-apps/cli` 安装 |

## 2. 常用命令

```bash
npm install
npm run dev          # 只启动 Vite
npm run dev:app      # Tauri dev，独立身份 com.dailytask.app.dev
npm run test         # Vitest
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run tauri build  # 安装包 + updater 签名
```

Rust：

```bash
cd src-tauri
cargo check
```

## 3. dev 与安装版

| | 开发版 | 安装版 |
|---|---|---|
| identifier | `com.dailytask.app.dev` | `com.dailytask.app` |
| 数据目录 | `%APPDATA%\com.dailytask.app.dev` | `%APPDATA%\com.dailytask.app` |
| 更新检查 | 关闭 | 开启 |
| 窗口标题 | DailyTask Dev | DailyTask |

两者可并存，数据互不影响。

## 4. 目录约定

```text
src/domain/     纯函数，无 IO / React / Tauri
src/db/         唯一允许 SQL 的层
src/stores/     Zustand + selectors
src/windows/    主窗 / 挂件
src/ui/         共享 UI 组件与 token
src/shared/     事件、i18n、队列、删除令牌
```

## 5. 数据重置

开发版数据：

```text
%APPDATA%\com.dailytask.app.dev\
  dailytask.db
  backup\
```

退出应用后删除 `dailytask.db` / `-wal` / `-shm` 即可重建。

## 6. 字体与缩放

- Windows 200% DPI 下挂件逻辑尺寸仍是 260×360
- 测试英文/中文长文案时重点看挂件、任务管理表格、设置页
