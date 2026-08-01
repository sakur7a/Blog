const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const { cleanupPreview, normalizeManifestPath } = require("../scripts/cleanup-obsidian-preview");

test("normalizes safe preview manifest paths", () => {
  const root = path.resolve("D:/MyBlog");
  const result = normalizeManifestPath(root, "_posts/demo.md");

  assert.equal(result.relative, "_posts/demo.md");
  assert.equal(result.fullPath, path.join(root, "_posts/demo.md"));
});

test("rejects preview manifest paths outside blog root", () => {
  const root = path.resolve("D:/MyBlog");

  assert.throws(() => normalizeManifestPath(root, "../outside.md"), /escapes blog root/);
  assert.throws(() => normalizeManifestPath(root, "D:/outside.md"), /Unsafe preview path/);
});

test("cleanup reads preview manifests with utf8 bom", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "preview-clean-"));
  fs.mkdirSync(path.join(root, "_posts"));
  fs.writeFileSync(path.join(root, "_posts", "demo.md"), "preview");
  fs.writeFileSync(
    path.join(root, ".obsidian-preview.json"),
    "\uFEFF" + JSON.stringify({ paths: ["_posts/demo.md"] }),
    "utf8"
  );

  const result = cleanupPreview(root);

  assert.equal(result.cleaned, true);
  assert.equal(fs.existsSync(path.join(root, "_posts", "demo.md")), false);
});

test("cleanup removes new untracked images from an existing tracked asset directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "preview-clean-git-"));
  const assetRelative = "assets/images/posts/2026-05-06-demo";
  const assetDir = path.join(root, assetRelative);
  fs.mkdirSync(assetDir, { recursive: true });
  fs.writeFileSync(path.join(assetDir, "existing.webp"), "existing", "utf8");

  spawnSync("git", ["init"], { cwd: root });
  spawnSync("git", ["add", "."], { cwd: root });
  spawnSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "initial"], { cwd: root });

  fs.writeFileSync(path.join(assetDir, "preview-only.webp"), "preview", "utf8");
  fs.writeFileSync(
    path.join(root, ".obsidian-preview.json"),
    JSON.stringify({ paths: [assetRelative], preservePaths: [`${assetRelative}/existing.webp`] }),
    "utf8"
  );

  cleanupPreview(root);

  assert.equal(fs.existsSync(path.join(assetDir, "existing.webp")), true);
  assert.equal(fs.existsSync(path.join(assetDir, "preview-only.webp")), false);
});

test("cleanup restores a tracked post deleted by a slug-change preview", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "preview-clean-deleted-"));
  const postRelative = "_posts/2026-05-06-old.md";
  const postPath = path.join(root, postRelative);
  fs.mkdirSync(path.dirname(postPath), { recursive: true });
  fs.writeFileSync(postPath, "original", "utf8");

  spawnSync("git", ["init"], { cwd: root });
  spawnSync("git", ["add", "."], { cwd: root });
  spawnSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "initial"], { cwd: root });
  fs.rmSync(postPath);
  fs.writeFileSync(path.join(root, ".obsidian-preview.json"), JSON.stringify({ paths: [postRelative] }), "utf8");

  cleanupPreview(root);

  assert.equal(fs.readFileSync(postPath, "utf8"), "original");
});
