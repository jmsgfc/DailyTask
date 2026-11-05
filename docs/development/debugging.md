# 调试与排障

> 状态：稳定
> 适用版本：v0.1.8+
> 相关：operations/troubleshooting.md、development/setup.md

---

## 1. 日志位置

- 前端：开发者工具 Console
- Tauri / Rust：`npm run dev:app` 终端输出
- 更新器：设置页错误文案 + Console
- SQLite：错误会进 Console，错误信息含 SQL 关键字

## 2. 常用排查

### 启动白屏

1. 看 Console 是否有 `[init] 初始化失败`
2. 检查 `%APPDATA%\com.dailytask.app.dev\dailytask.db` 是否被占用
3. 迁移失败时先备份 DB，再删除 `-wal` / `-shm`
4. `cargo check` 确认 Rust 侧没有编译错误

### 跨窗口不同步

1. 确认写库后 emit 了对应事件
2. 确认监听方 `source` 去重逻辑
3. Console 搜 `[sync]`
4. 主窗与挂件是否连到同一个 DB 文件

### 托盘菜单文案不对

1. `useTrayLabels` 是否在 App 挂载
2. `invoke("set_tray_labels")` 参数是否 camelCase
3. 语言切换后 `useLocale` 是否触发重渲染
4. 托盘可见性变化后 `sync_tray_labels` 是否执行

### 挂件尺寸/位置异常

1. 200% DPI 下逻辑尺寸仍是 260×360
2. 检查 `applyWidgetLayout` 的边距与屏幕工作区
3. 胶囊停靠侧存 localStorage，清掉可复位

### 日期错位

1. 今天只允许 `logicalToday()` 产出
2. 检查 `dayStartHour`
3. 检查时区 / DST 用例
4. 不要用 `toISOString().slice(0,10)` 当本地日期

### 删除没反应

1. 确认走的是 `ConfirmDeleteButton`
2. store `remove` 是否收到 `DeleteConfirmation`
3. 确认框是否因失败保留
4. 检查 `[delete] 删除失败` 日志

## 3. 数据恢复

1. 退出应用（托盘 → 退出）
2. 备份当前 `dailytask.db`
3. 从 `backup/` 复制最近的 `dailytask-YYYYMMDD.db` 或 `pre-update-*.db`
4. 删除 `-wal` / `-shm`
5. 启动核对

详见 [升级与回退](../operations/upgrade-rollback.md)。
