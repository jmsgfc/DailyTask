# 本地开发：从零跑起来

> 类型：教程
> 状态：稳定
> 适用版本：v0.1.9+
> 相关：reference/commands.md、how-to/testing.md

跟着本文走一遍，你会得到能启动的开发版、能跑的测试和可调试的窗口。

---

## 1. 准备环境

需要：

- Node.js 22+
- npm 10+
- Rust stable + MSVC toolchain
- Windows 10/11

检查：

```bash
node -v
npm -v
rustc --version
cargo --version
```

## 2. 安装依赖

```bash
npm install
```

预期：`node_modules` 生成，无报错。

## 3. 启动开发版

```bash
npm run dev:app
```

预期：

- 主窗口打开
- 悬浮挂件出现
- 终端显示 Tauri / Vite 编译日志

开发版与安装版数据隔离：

```text
%APPDATA%\com.dailytask.app.dev
```

## 4. 改一个界面文案

1. 打开 `src/shared/i18n/zh-CN.ts`
2. 修改 `"nav.today"` 的值
3. 保存

预期：窗口自动热更新，左侧导航文字变化。

## 5. 跑测试

```bash
npm run test
```

预期：全部测试通过。重点测试文件：

- `src/domain/*.test.ts`
- `src/db/*.test.ts`
- `src/windows/**/*.test.tsx`

## 6. 检查分层

```bash
npm run lint
npm run typecheck
```

预期：无错误。如果 view 直接 import `db/*`，lint 会拦下。

## 7. 看数据

开发版数据库：

```text
%APPDATA%\com.dailytask.app.dev\dailytask.db
```

退出应用后可删除 `dailytask.db` / `-wal` / `-shm` 重建。

## 8. 下一步

- 命令表：[reference/commands.md](../reference/commands.md)
- 测试指南：[how-to/testing.md](../how-to/testing.md)
- 架构解释：[explanation/architecture.md](../explanation/architecture.md)
