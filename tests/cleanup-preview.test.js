const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
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
