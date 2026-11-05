# 发版

> 类型：操作指南
> 状态：稳定
> 适用版本：v0.1.9+
> 相关：how-to/upgrade-and-rollback.md、how-to/testing.md、project/changelog.md

---

## 1. 发版前

```bash
npm run test
npm run lint
npm run typecheck
cargo check
```

UI 改动先 `npm run dev:app` 手动走查：

- 中文 / English
- 200% DPI
- 挂件 260px 长文案
- 任务管理表格
- 托盘菜单

## 2. 版本规则

- 补丁 / 小功能：`+0.0.1`
- 破坏性数据变更：必须带迁移 + 旧 JSON 兼容 + 发布说明写明
- `package.json` / `package-lock.json` / `tauri.conf.json` / `Cargo.toml` / `Cargo.lock` 必须一致

版本由脚本更新，不要手改多个文件。

## 3. 一条命令

```bash
node scripts/release.mjs 0.1.9 \
  --notes "中文说明" \
  --notes-en "English notes"
```

脚本顺序：

1. `npm version <ver> --no-git-tag-version --ignore-scripts`（同步 package-lock）
2. bump `tauri.conf.json` / `Cargo.toml`
3. `npm run tauri build`（签名）
4. 生成 `latest.json`
5. 提交并推送版本号
6. `gh release create` 上传安装包 + `.sig`
7. `gh release upload latest.json`

## 4. 签名

| 项 | 位置 |
|---|---|
| 私钥 | `%USERPROFILE%\.tauri\dailytask.key` |
| 密码 | 环境变量 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` |
| 密码副本 | `%USERPROFILE%\.tauri\dailytask-signing-password.txt` |
| 公钥 | `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey` |

私钥或密码丢失后无法再推送更新，只能让用户手动重装。

## 5. 产物验证

```bash
gh release view v0.1.9
```

确认：

- 非 draft / 非 prerelease
- 三个资产：安装包、`.sig`、`latest.json`
- `latest.json` 版本与安装包一致
- 安装版检查更新能看到新版本

## 6. 代理问题

如果 `git push` 报：

```text
Failed to connect to github.com:443 over proxy 127.0.0.1
```

说明本地代理不可用。可临时绕过：

```bash
git -c http.proxy= -c https.proxy= push
```

然后手动补做：

```bash
gh release create vX.Y.Z <exe> <sig> --title vX.Y.Z --notes "..."
gh release upload vX.Y.Z latest.json --clobber
```

## 7. 发布后

- 更新 `project/changelog.md`
- 更新 `project/progress.md`
- 需要时补 `docs/reference/*` 与 README
- 在安装版上走一次应用内更新
