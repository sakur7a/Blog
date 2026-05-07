const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("plugin entry is self contained for Obsidian runtime loading", () => {
  const main = fs.readFileSync("obsidian/.obsidian/plugins/sakura-blog-publisher/main.js", "utf8");

  assert.equal(main.includes('require("./metadata")'), false);
});

test("plugin accepts notes outside the blog directory", () => {
  const main = fs.readFileSync("obsidian/.obsidian/plugins/sakura-blog-publisher/main.js", "utf8");

  assert.equal(main.includes("当前文件不在博客目录下"), false);
  assert.equal(main.includes("publishPath"), true);
});

test("plugin exposes cleanup for the last preview", () => {
  const main = fs.readFileSync("obsidian/.obsidian/plugins/sakura-blog-publisher/main.js", "utf8");

  assert.equal(main.includes("cleanup-last-preview"), true);
  assert.equal(main.includes("scripts/cleanup-obsidian-preview.js"), true);
  assert.equal(main.includes("清理上次预览"), true);
});

test("plugin supports choosing a cover image for publishing", () => {
  const main = fs.readFileSync("obsidian/.obsidian/plugins/sakura-blog-publisher/main.js", "utf8");

  assert.equal(main.includes("选择封面图"), true);
  assert.equal(main.includes("--cover"), true);
  assert.equal(main.includes("--cover-position"), true);
  assert.equal(main.includes("coverPosition"), true);
  assert.equal(main.includes("调整封面显示区域"), true);
  assert.equal(main.includes("arrayBuffer()"), true);
  assert.equal(main.includes("file.path ||"), false);
});

test("plugin exposes separate cover focus controls", () => {
  const main = fs.readFileSync("obsidian/.obsidian/plugins/sakura-blog-publisher/main.js", "utf8");

  assert.equal(main.includes("横向焦点"), true);
  assert.equal(main.includes("纵向焦点"), true);
  assert.equal(main.includes("sakura-publisher-cover-range"), true);
  assert.equal(main.includes("setCoverPosition"), true);
});
