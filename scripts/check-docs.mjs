#!/usr/bin/env node
/**
 * 文档守卫：必需文件、状态头、Markdown 相对链接。
 * 用法：npm run docs:check
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = join(root, "docs");

const required = [
  "docs/README.md",
  "docs/glossary.md",
  "docs/impl.md",
  "docs/product/requirements.md",
  "docs/product/decisions.md",
  "docs/product/backlog.md",
  "docs/product/changelog.md",
  "docs/product/roadmap.md",
  "docs/architecture/overview.md",
  "docs/architecture/data.md",
  "docs/architecture/domain.md",
  "docs/architecture/windows.md",
  "docs/architecture/grid.md",
  "docs/architecture/i18n.md",
  "docs/development/setup.md",
  "docs/development/testing.md",
  "docs/development/conventions.md",
  "docs/development/debugging.md",
  "docs/operations/release.md",
  "docs/operations/upgrade-rollback.md",
  "docs/operations/backup.md",
  "docs/operations/troubleshooting.md",
  "docs/project/progress.md",
];

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

  if (file.startsWith(docsRoot) && !/^> 状态：/m.test(text)) {
    failures.push(`缺少状态头：${relative}`);
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
