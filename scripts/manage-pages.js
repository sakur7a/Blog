#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

function splitFrontMatter(content) {
  const match = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { yaml: "", body: content };
  return { yaml: match[1], body: match[2] };
}

function readYamlValue(yaml, key) {
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(.+?)\\s*$`, "m");
  const match = String(yaml).match(pattern);
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function listPages() {
  const pages = [];

  for (const fileName of fs.readdirSync(root)) {
    if (!/\.(md|html)$/i.test(fileName)) continue;
    const fullPath = path.join(root, fileName);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;

    const content = fs.readFileSync(fullPath, "utf8").replace(/^﻿/, "");
    const { yaml } = splitFrontMatter(content);
    const layout = readYamlValue(yaml, "layout");
    if (layout !== "page") continue;

    const title = readYamlValue(yaml, "title") || fileName.replace(/\.(md|html)$/i, "");
    const headerImage = readYamlValue(yaml, "header_image") || readYamlValue(yaml, "cover") || "";
    pages.push({ title, path: fileName, headerImage });
  }

  return pages;
}

function createPage(title) {
  const slug = title
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "new-page";
  const filePath = path.join(root, `${slug}.md`);

  if (fs.existsSync(filePath)) {
    process.stderr.write(`文件已存在：${filePath}`);
    process.exit(1);
  }

  const content = `---\nlayout: page\ntitle: "${title}"\n---\n\n在这里编写内容。\n`;
  fs.writeFileSync(filePath, content, "utf8");
  process.stdout.write(JSON.stringify({ path: slug + ".md", title }));
}

function writeYamlValue(yaml, key, value) {
  const line = `${key}: ${value}`;
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*.+?$`, "m");
  if (pattern.test(yaml)) return yaml.replace(pattern, line);
  return yaml.trim() ? `${yaml.trimEnd()}\n${line}` : line;
}

function setHeaderImage(pagePath, imageUrl) {
  const fullPath = path.join(root, pagePath);
  if (!fs.existsSync(fullPath)) {
    process.stderr.write(`文件不存在：${pagePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(fullPath, "utf8").replace(/^﻿/, "");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    process.stderr.write("文件没有 front matter");
    process.exit(1);
  }

  let yaml = match[1];
  const body = match[2];
  yaml = writeYamlValue(yaml, "header_image", `"${imageUrl}"`);
  const newContent = `---\n${yaml.trim()}\n---\n${body}`;
  fs.writeFileSync(fullPath, newContent, "utf8");
  process.stdout.write("ok");
}

function pushPages() {
  try {
    execSync("git add -A", { cwd: root, stdio: "pipe" });

    const staged = execSync("git diff --cached --name-only", { cwd: root, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
    if (!staged) {
      process.stdout.write("no-changes");
      return;
    }

    execSync('git commit -m "update: 更新独立页面"', { cwd: root, stdio: "pipe" });
    execSync("git push", { cwd: root, stdio: "pipe" });
    process.stdout.write("ok");
  } catch (error) {
    process.stderr.write(error.message || "推送失败");
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const command = args[0];

if (command === "list") {
  process.stdout.write(JSON.stringify(listPages()));
} else if (command === "create") {
  const titleIndex = args.indexOf("--title");
  const title = titleIndex !== -1 ? args[titleIndex + 1] : "";
  if (!title) {
    process.stderr.write("缺少 --title 参数");
    process.exit(1);
  }
  createPage(title);
} else if (command === "push") {
  pushPages();
} else if (command === "set-header-image") {
  const pageIndex = args.indexOf("--page");
  const imageIndex = args.indexOf("--image");
  const page = pageIndex !== -1 ? args[pageIndex + 1] : "";
  const image = imageIndex !== -1 ? args[imageIndex + 1] : "";
  if (!page || !image) {
    process.stderr.write("缺少 --page 或 --image 参数");
    process.exit(1);
  }
  setHeaderImage(page, image);
} else {
  process.stderr.write(`未知命令：${command}\n用法：manage-pages.js <list|create|push>`);
  process.exit(1);
}
