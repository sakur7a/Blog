const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { listPosts } = require("../scripts/list-posts");
const { deletePost, normalizePostPath } = require("../scripts/manage-post");

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-manage-"));
  fs.mkdirSync(path.join(root, "_posts"), { recursive: true });
  fs.mkdirSync(path.join(root, "obsidian", "Published"), { recursive: true });
  fs.mkdirSync(path.join(root, "assets", "images", "posts"), { recursive: true });
  return root;
}

test("lists posts with metadata and management paths", () => {
  const root = makeRoot();
  fs.writeFileSync(
    path.join(root, "_posts", "2026-05-06-ml.md"),
    [
      "---",
      'title: "ML"',
      "date: 2026-05-06 20:00:00 +0800",
      "categories: [学习]",
      'summary: "机器学习笔记"',
      'source_file: "原始笔记.md"',
      "---",
      "",
      "正文"
    ].join("\n"),
    "utf8"
  );
  fs.writeFileSync(path.join(root, "obsidian", "Published", "原始笔记.md"), "source", "utf8");

  const posts = listPosts(root, { baseUrl: "https://sakur7a.github.io", basePath: "/Blog" });

  assert.equal(posts.length, 1);
  assert.equal(posts[0].title, "ML");
  assert.equal(posts[0].category, "学习");
  assert.equal(posts[0].dateValue, "2026-05-06 20:00:00 +0800");
  assert.equal(posts[0].summary, "机器学习笔记");
  assert.equal(posts[0].postPath, "_posts/2026-05-06-ml.md");
  assert.equal(posts[0].assetPath, "assets/images/posts/2026-05-06-ml");
  assert.equal(posts[0].sourcePath, "obsidian/Published/原始笔记.md");
  assert.equal(posts[0].url, "https://sakur7a.github.io/Blog/2026-05-06/ml.html");
});

test("deletePost removes the post and optionally its assets", () => {
  const root = makeRoot();
  const postPath = path.join(root, "_posts", "2026-05-06-ml.md");
  const assetDir = path.join(root, "assets", "images", "posts", "2026-05-06-ml");
  fs.writeFileSync(postPath, "---\ntitle: ML\n---\n正文", "utf8");
  fs.mkdirSync(assetDir, { recursive: true });
  fs.writeFileSync(path.join(assetDir, "cover.png"), "image", "utf8");

  const result = deletePost(root, "_posts/2026-05-06-ml.md", { deleteAssets: true, noCommit: true, noPush: true, skipBuild: true });

  assert.deepEqual(result.removed, ["_posts/2026-05-06-ml.md", "assets/images/posts/2026-05-06-ml"]);
  assert.equal(fs.existsSync(postPath), false);
  assert.equal(fs.existsSync(assetDir), false);
});

test("normalizePostPath rejects paths outside _posts", () => {
  const root = makeRoot();

  assert.throws(() => normalizePostPath(root, "../_config.yml"), /Post path must be inside _posts/);
  assert.throws(() => normalizePostPath(root, "assets/images/demo.png"), /Post path must be inside _posts/);
});

test("listPosts ignores source_file paths that escape Published", () => {
  const root = makeRoot();
  fs.writeFileSync(
    path.join(root, "_posts", "2026-05-06-demo.md"),
    '---\ntitle: "Demo"\nsource_file: "../../outside.md"\n---\nbody',
    "utf8"
  );
  fs.writeFileSync(path.join(root, "outside.md"), "outside", "utf8");

  const [post] = listPosts(root);

  assert.equal(post.sourcePath, "");
});

test("deletePost restores files if build fails", () => {
  const root = makeRoot();
  const postPath = path.join(root, "_posts", "2026-05-06-ml.md");
  const assetDir = path.join(root, "assets", "images", "posts", "2026-05-06-ml");
  fs.writeFileSync(postPath, "---\ntitle: ML\n---\n正文", "utf8");
  fs.mkdirSync(assetDir, { recursive: true });
  fs.writeFileSync(path.join(assetDir, "cover.png"), "image", "utf8");
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: { build: "node missing-build.js" } }), "utf8");

  assert.throws(() => deletePost(root, "_posts/2026-05-06-ml.md", { deleteAssets: true, noCommit: true, noPush: true }), /npm failed/);
  assert.equal(fs.existsSync(postPath), true);
  assert.equal(fs.existsSync(path.join(assetDir, "cover.png")), true);
});
