const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

test("republishing preserves the first timestamp, cover, and post-scoped images", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-republish-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const scriptsDir = path.join(root, "scripts");
  const postsDir = path.join(root, "_posts");
  const publishedDir = path.join(root, "obsidian", "Published");
  const assetDir = path.join(root, "assets", "images", "posts", "2026-05-06-demo");
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(postsDir, { recursive: true });
  fs.mkdirSync(publishedDir, { recursive: true });
  fs.mkdirSync(assetDir, { recursive: true });

  fs.copyFileSync(
    path.join(__dirname, "..", "scripts", "publish-obsidian-post.ps1"),
    path.join(scriptsDir, "publish-obsidian-post.ps1")
  );
  fs.writeFileSync(path.join(scriptsDir, "compress-images.js"), "process.exit(0);\n", "utf8");

  const postPath = path.join(postsDir, "2026-05-06-demo.md");
  fs.writeFileSync(
    postPath,
    [
      "---",
      'title: "Demo"',
      "date: 2026-05-06 20:00:00 +0800",
      'slug: "demo"',
      'source_file: "source.md"',
      'cover: "/assets/images/posts/2026-05-06-demo/cover.webp"',
      "---",
      "",
      "old"
    ].join("\n"),
    "utf8"
  );
  fs.writeFileSync(path.join(assetDir, "photo.webp"), "existing-image", "utf8");
  fs.writeFileSync(path.join(assetDir, "cover.webp"), "existing-cover", "utf8");

  const draftPath = path.join(publishedDir, "source.md");
  fs.writeFileSync(
    draftPath,
    [
      "---",
      'title: "Demo"',
      "date: 2026-08-02 09:30:00 +0800",
      "slug: demo",
      "---",
      "",
      "![[folder/photo.png]]"
    ].join("\n"),
    "utf8"
  );

  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(scriptsDir, "publish-obsidian-post.ps1"),
      draftPath,
      "-DateOverride",
      "2026-08-02 09:30:00 +0800",
      "-NoCommit",
      "-NoPush"
    ],
    { cwd: root, encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const published = fs.readFileSync(postPath, "utf8");
  assert.match(published, /^date: 2026-05-06 20:00:00 \+0800$/m);
  assert.match(published, /^cover: "\/assets\/images\/posts\/2026-05-06-demo\/cover\.webp"$/m);
  assert.match(published, /2026-05-06-demo\/photo\.webp/);
  assert.doesNotMatch(published, /photo\.png/);
});
