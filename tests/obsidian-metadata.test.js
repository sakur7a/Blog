const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  applyMetadata,
  extractMetadata,
  firstSummary
} = require("../obsidian/.obsidian/plugins/sakura-blog-publisher/metadata");

test("extracts title summary and category from front matter", () => {
  const metadata = extractMetadata(`---\ntitle: "标题"\ncategories: [学习]\nsummary: "简介"\n---\n正文`, "draft.md");

  assert.deepEqual(metadata, {
    title: "标题",
    summary: "简介",
    category: "学习"
  });
});

test("infers metadata when front matter is missing", () => {
  const metadata = extractMetadata("第一段简介。\n\n正文继续。", "obsidian/Drafts/我的文章.md");

  assert.equal(metadata.title, "我的文章");
  assert.equal(metadata.summary, "第一段简介。");
  assert.equal(metadata.category, "随笔");
});

test("applies metadata to a note", () => {
  const next = applyMetadata("正文", {
    title: "新标题",
    summary: "新简介",
    category: "学习"
  });

  assert.match(next, /title: "新标题"/);
  assert.match(next, /summary: "新简介"/);
  assert.match(next, /categories: \[学习\]/);
  assert.match(next, /\n\n正文$/);
});

test("summary ignores markdown image syntax", () => {
  assert.equal(firstSummary("![[a.png]]\n\n# 标题\n第一段"), "标题");
});
