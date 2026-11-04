# 升级与回退

> 适用版本：v0.1.0 起。更新由 `tauri-plugin-updater` + GitHub Releases 提供，
> 端点固定在 `https://github.com/yearzen1/DailyTask/releases/latest/download/latest.json`。

## 1. 产物与签名

| 产物 | 位置 |
|---|---|
| 安装包 | `src-tauri/target/release/bundle/nsis/DailyTask_<version>_x64-setup.exe` |
| 安装包签名 | 同目录 `<安装包>.sig` |
| 更新清单 | 仓库根目录 `latest.json`（发布时上传，不提交） |
| 私钥 | `%USERPROFILE%\.tauri\dailytask.key`（不进仓库） |
| 私钥密码 | 当前用户环境变量 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`，并留一份在 `%USERPROFILE%\.tauri\dailytask-signing-password.txt` |

公钥写在 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`。**私钥或密码丢失后无法再推送更新**，
只能让用户手动重装；新机器发布前先从密码管理器恢复这两项。

## 2. 发版

```bash
node scripts/release.mjs 0.1.2 \
  --notes "中文说明：本次改了什么" \
  --notes-en "English notes: what changed"
```

发布说明必须中英双语，缺任意一侧脚本会直接退出。脚本按顺序执行：改版本
（package.json / tauri.conf.json / Cargo.toml）→ 签名构建 → 生成 `latest.json` →
提交并推送版本号 → 创建 GitHub Release 上传安装包与签名 → 把 `latest.json` 传到同一个 Release。

先看要发什么，不执行：

```bash
node scripts/release.mjs 0.1.2 --dry-run \
  --notes "中文说明" \
  --notes-en "English notes"
```

## 3. 应用内升级

1. 启动时静默检查一次更新；发现新版本时「设置」导航出现红点。
2. 设置 → 应用更新 → 安装并重启。
3. 安装前自动把数据库复制为 `pre-update-<version>.db`；快照失败会中止安装。
4. 安装器完成后应用重启，数据仍在 `%APPDATA%\com.dailytask.app\dailytask.db`。

## 4. 备份位置

```
%APPDATA%\com.dailytask.app\backup\
  dailytask-YYYYMMDD.db      每日轮转，保留最近 7 份
  pre-update-<version>.db    每次安装更新前的快照，不自动清理
```

## 5. 回退步骤

更新器不支持降级，需要手动重装旧版：

1. 托盘右键 → 退出（确保进程结束，避免数据库被占用）。
2. 把 `backup\pre-update-<version>.db` 复制为 `%APPDATA%\com.dailytask.app\dailytask.db`；
   同时删除同目录的 `dailytask.db-wal` / `dailytask.db-shm`。
3. 在 Windows「设置 → 应用」卸载 DailyTask，或运行安装目录里的 `uninstall.exe`。
4. 从 GitHub Releases 下载并安装旧版安装包。
5. 启动后核对最近几天的打卡与任务区间；确认无误后再继续使用或重新升级。
