#!/usr/bin/env node
/**
 * 文档守卫：必需文件、Diátaxis 类型、状态头、Markdown 相对链接。
 * 用法：npm run docs:check
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = join(root, "docs");

const required = [
  "docs/README.md",
  "docs/tutorials/first-run.md",
  "docs/tutorials/local-development.md",
  "docs/how-to/daily-use.md",
  "docs/how-to/manage-tasks.md",
  "docs/how-to/manage-todos.md",
  "docs/how-to/use-the-grid.md",
  "docs/how-to/switch-language.md",
  "docs/how-to/add-a-language.md",
  "docs/how-to/backup-and-restore.md",
  "docs/how-to/upgrade-and-rollback.md",
  "docs/how-to/release.md",
  "docs/how-to/testing.md",
  "docs/how-to/troubleshoot.md",
  "docs/reference/checkins.md",
  "docs/reference/tasks-and-intervals.md",
  "docs/reference/todos.md",
  "docs/reference/settings.md",
  "docs/reference/data-model.md",
  "docs/reference/domain-functions.md",
  "docs/reference/grid.md",
  "docs/reference/windows-and-tray.md",
  "docs/reference/i18n.md",
  "docs/reference/ui-spec.md",
  "docs/reference/conventions.md",
  "docs/reference/commands.md",
  "docs/reference/file-locations.md",
  "docs/reference/glossary.md",
  "docs/explanation/product-decisions.md",
  "docs/explanation/architecture.md",
  "docs/explanation/roadmap.md",
  "docs/project/progress.md",
  "docs/project/changelog.md",
  "docs/project/backlog.md",
];

const allowedTypes = ["教程", "操作指南", "参考", "解释", "项目记录", "入口"];
const failures = [];

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      files.push(...walk(path));
    } else if (name.endsWith(".md")) {
      files.push(path);
    }
  }
  return files;
}

for (const relative of required) {
  if (!existsSync(join(root, relative))) {
    failures.push(`缺少必需文档：${relative}`);
  }
}

const files = [join(root, "README.md"), join(root, "README.zh-CN.md"), ...walk(docsRoot)];
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;

for (const file of files) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  const relative = file.slice(root.length + 1);

  if (file.startsWith(docsRoot)) {
    const type = text.match(/^> 类型：(.+)$/m)?.[1]?.trim();
    if (!type) {
      failures.push(`缺少类型头：${relative}`);
    } else if (!allowedTypes.includes(type)) {
      failures.push(`未知文档类型「${type}」：${relative}`);
    }
    if (!/^> 状态：/m.test(text)) {
      failures.push(`缺少状态头：${relative}`);
    }
  }

  for (const match of text.matchAll(linkPattern)) {
    const raw = match[1].trim();
    if (
      raw.startsWith("http://") ||
      raw.startsWith("https://") ||
      raw.startsWith("mailto:") ||
      raw.startsWith("#")
    ) {
      continue;
    }
    const targetPath = raw.split("#")[0].split(" ")[0];
    if (!targetPath) continue;
    const target = resolve(dirname(file), targetPath);
    if (!existsSync(target)) {
      failures.push(`失效链接：${relative} -> ${raw}`);
    }
  }
}

if (failures.length > 0) {
  console.error("docs:check 失败：");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`docs:check 通过（${files.length} 个 Markdown 文件）`);
