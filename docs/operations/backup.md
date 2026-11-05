# 备份与恢复

> 状态：稳定
> 适用版本：v0.1.8+
> 相关：operations/upgrade-rollback.md、architecture/data.md

---

## 1. 位置

```text
%APPDATA%\com.dailytask.app\
  dailytask.db
  dailytask.db-wal
  dailytask.db-shm
  backup\
    dailytask-YYYYMMDD.db
    pre-update-<version>.db
```

开发版把 `com.dailytask.app` 换成 `com.dailytask.app.dev`。

## 2. 自动备份

| 类型 | 触发 | 保留 |
|---|---|---|
| 每日轮转 | 主窗启动，每天首次 | 最近 7 份 |
| 更新前快照 | 安装更新前 | 不自动清理 |

规则：

- 同一天不重复生成每日备份
- `pre-update-*` 不参与 7 份清理
- 复制前 `PRAGMA wal_checkpoint(TRUNCATE)` 合并 WAL
- 快照失败会中止更新安装

## 3. 手动恢复

1. 托盘 → 退出，确保进程结束
2. 备份当前 `dailytask.db`
3. 复制目标备份为 `dailytask.db`
4. 删除 `dailytask.db-wal` / `dailytask.db-shm`
5. 启动核对最近打卡与任务区间

## 4. JSON 迁移

- 设置 → 导出 JSON：任务、区间、打卡、待办、设置
- 设置 → 导入 JSON：按 id 合并，本地多出的行保留
- 导入前建议先退出另一个窗口或先做备份
- 旧 JSON 的 `recorded` 自动转 `done`

## 5. 注意

- 备份是完整 SQLite 文件，不依赖应用版本
- 不要同时运行两个实例写同一个 DB
- 更新器不支持降级；回退要手动重装旧版
