# DailyTask 文档地图

> 状态：稳定
> 适用版本：v0.1.8+
> 入口：先看本页，再按角色选阅读路径

本项目采用文档驱动开发：**文档是契约，代码对齐文档**。一个事实只在一篇文档里定义，其他文档只链接，不复制。

---

## 1. 文档分层

```text
入口       docs/README.md · README.md / README.zh-CN.md
产品契约   product/requirements.md · product/decisions.md
架构契约   architecture/overview.md · data / domain / windows / grid / i18n
开发手册   development/setup.md · testing.md · conventions.md · debugging.md
运维手册   operations/release.md · upgrade-rollback.md · backup.md · troubleshooting.md
项目记录   project/progress.md · roadmap.md · product/changelog.md
决策存档   adr/
术语       glossary.md
```

## 2. 阅读路径

### 新用户 / 产品视角

1. [产品需求](product/requirements.md)
2. [产品口径与决策](product/decisions.md)
3. [术语表](glossary.md)

### 开发者

1. [架构总览](architecture/overview.md)
2. [数据层](architecture/data.md)
3. [领域算法](architecture/domain.md)
4. [两个窗口](architecture/windows.md)
5. [任务表网格](architecture/grid.md)
6. [国际化](architecture/i18n.md)
7. [开发环境](development/setup.md)
8. [测试](development/testing.md)
9. [约定](development/conventions.md)

### 发版 / 维护者

1. [发版流程](operations/release.md)
2. [升级与回退](operations/upgrade-rollback.md)
3. [备份](operations/backup.md)
4. [故障排查](operations/troubleshooting.md)
5. [版本记录](product/changelog.md)

## 3. 文档责任表

| 改动区域 | 必须同步 |
|---|---|
| `src/domain/**` | `architecture/domain.md`、`development/testing.md` |
| `src/db/**`、`src-tauri/migrations/**` | `architecture/data.md`、`operations/backup.md` |
| `src/windows/**`、`src/ui/**` | `architecture/windows.md` / `grid.md`；交互变化补 `product/decisions.md` |
| `src/shared/i18n/**` | `architecture/i18n.md` |
| `src-tauri/src/lib.rs`（托盘/窗口） | `architecture/windows.md` |
| `scripts/release.mjs`、签名配置 | `operations/release.md` |
| 产品规则 / 状态语义 | `product/decisions.md`、`product/requirements.md` |
| 版本发布 | `product/changelog.md`、`project/progress.md` |

## 4. 文档状态标记

每篇文档顶部使用：

```md
> 状态：稳定 / 迭代中 / 历史
> 适用版本：v0.1.8+
> 相关：architecture/data.md
```

- **稳定**：当前行为的契约，改行为必须同步改它
- **迭代中**：正在变化，允许与代码短暂不完全一致，但必须写清缺口
- **历史**：只读，不再维护；新的说明写到稳定文档

## 5. 校验

```bash
npm run docs:check
```

检查：

- 必需文档是否存在
- Markdown 相对链接是否有效
- 每篇文档是否有状态头

## 6. 文档变更规则

1. 先改文档，再改代码（纯拼写/格式除外）
2. 一个事实只写一处；其他位置用链接
3. 命令、路径、配置键必须可直接复制
4. 图表优先 Mermaid / ASCII，不贴大段截图
5. 文档与代码同一个 PR / 提交批次
