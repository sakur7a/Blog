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
  assert.equal(main.includes("未选择新封面：重新发布将沿用已有封面；首次发布则不设置封面。"), true);
});

test("plugin exposes separate cover focus controls", () => {
  const main = fs.readFileSync("obsidian/.obsidian/plugins/sakura-blog-publisher/main.js", "utf8");

  assert.equal(main.includes("横向焦点"), true);
  assert.equal(main.includes("纵向焦点"), true);
  assert.equal(main.includes("sakura-publisher-cover-range"), true);
  assert.equal(main.includes("setCoverPosition"), true);
});

test("plugin exposes a post management panel", () => {
  const main = fs.readFileSync("obsidian/.obsidian/plugins/sakura-blog-publisher/main.js", "utf8");

  assert.equal(main.includes("manage-content"), true);
  assert.equal(main.includes("管理文章和页面"), true);
  assert.equal(main.includes("scripts/list-posts.js"), true);
  assert.equal(main.includes("scripts/manage-post.js"), true);
  assert.equal(main.includes("--date"), true);
  assert.equal(main.includes("--slug"), true);
  assert.equal(main.includes("复制链接"), true);
  assert.equal(main.includes("重新发布"), true);
  assert.equal(main.includes("删除"), true);
});
