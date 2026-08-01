const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

function makePublisherRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-publish-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, "_posts"), { recursive: true });
  fs.mkdirSync(path.join(root, "assets", "images", "posts"), { recursive: true });
  fs.mkdirSync(path.join(root, "obsidian", "Published"), { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, "..", "scripts", "publish-obsidian-post.ps1"),
    path.join(root, "scripts", "publish-obsidian-post.ps1")
  );
  fs.writeFileSync(path.join(root, "scripts", "compress-images.js"), "process.exit(0);\n", "utf8");
  return root;
}

function runPublisher(root, draftPath, extraArgs = []) {
  return spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(root, "scripts", "publish-obsidian-post.ps1"),
      draftPath,
      ...extraArgs
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PATH: `${root}${path.delimiter}${process.env.PATH || ""}` }
    }
  );
}

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
  assert.match(published, /2026-05-06-demo\/photo-[a-f0-9]{8}\.webp/);
  assert.doesNotMatch(published, /photo\.png/);

  const preservedSource = fs.readFileSync(draftPath, "utf8");
  assert.match(preservedSource, /^date: 2026-05-06 20:00:00 \+0800$/m);
  assert.match(preservedSource, /^source_file: "source\.md"$/m);
  assert.match(preservedSource, /^cover: "\/assets\/images\/posts\/2026-05-06-demo\/cover\.webp"$/m);
  assert.match(preservedSource, /!\[\[folder\/photo\.png\]\]/);
});

test("publishing keeps nested same-name images distinct and sanitizes asset names", (t) => {
  const root = makePublisherRoot(t);
  const draftDir = path.join(root, "drafts");
  fs.mkdirSync(path.join(draftDir, "a"), { recursive: true });
  fs.mkdirSync(path.join(draftDir, "b"), { recursive: true });
  fs.mkdirSync(path.join(draftDir, "c"), { recursive: true });
  fs.writeFileSync(path.join(draftDir, "a", "photo.png"), "image-a", "utf8");
  fs.writeFileSync(path.join(draftDir, "b", "photo.png"), "image-b", "utf8");
  fs.writeFileSync(path.join(draftDir, "c", "author's.png"), "image-c", "utf8");
  fs.writeFileSync(path.join(draftDir, "space image.png"), "image-space", "utf8");

  const draftPath = path.join(draftDir, "source.md");
  fs.writeFileSync(
    draftPath,
    [
      "---",
      'title: "Images"',
      "date: 2026-05-06 20:00:00 +0800",
      "slug: images",
      "---",
      "",
      "![[a/photo.png]]",
      "![[b/photo.png]]",
      "![[c/author's.png]]",
      "![](<space%20image.png>)",
      "![](/assets/images/site/existing.png)"
    ].join("\n"),
    "utf8"
  );

  const result = runPublisher(root, draftPath, ["-NoCommit", "-NoPush"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const post = fs.readFileSync(path.join(root, "_posts", "2026-05-06-images.md"), "utf8");
  const photoNames = [...post.matchAll(/2026-05-06-images\/(photo-[a-f0-9]{8}\.png)/g)].map((match) => match[1]);
  assert.equal(new Set(photoNames).size, 2);
  assert.match(post, /author-s-[a-f0-9]{8}\.png/);
  assert.match(post, /2026-05-06-images\/space image\.png/);
  assert.match(post, /!\[\]\(\/assets\/images\/site\/existing\.png\)/);

  const assetDir = path.join(root, "assets", "images", "posts", "2026-05-06-images");
  const copied = photoNames.map((name) => fs.readFileSync(path.join(assetDir, name), "utf8")).sort();
  assert.deepEqual(copied, ["image-a", "image-b"]);
});

test("publishing rejects unsafe slugs before writing files", (t) => {
  const root = makePublisherRoot(t);
  const draftPath = path.join(root, "unsafe.md");
  fs.writeFileSync(draftPath, "---\ntitle: Unsafe\nslug: ../outside\n---\nbody", "utf8");

  const result = runPublisher(root, draftPath, ["-NoCommit", "-NoPush"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid slug/);
  assert.deepEqual(fs.readdirSync(path.join(root, "_posts")), []);
});

test("publishing refuses ambiguous duplicate slugs", (t) => {
  const root = makePublisherRoot(t);
  fs.writeFileSync(path.join(root, "_posts", "2026-05-06-duplicate.md"), "---\nslug: duplicate\n---\nold", "utf8");
  fs.writeFileSync(path.join(root, "_posts", "2026-05-07-duplicate.md"), "---\nslug: duplicate\n---\nold", "utf8");
  const draftPath = path.join(root, "duplicate.md");
  fs.writeFileSync(draftPath, "---\ntitle: Duplicate\nslug: duplicate\n---\nbody", "utf8");

  const result = runPublisher(root, draftPath, ["-NoCommit", "-NoPush"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Multiple published posts use slug 'duplicate'/);
});

test("publishing stops instead of committing a broken local image reference", (t) => {
  const root = makePublisherRoot(t);
  const draftPath = path.join(root, "missing-image.md");
  fs.writeFileSync(
    draftPath,
    "---\ntitle: Missing image\ndate: 2026-05-06 20:00:00 +0800\nslug: missing-image\n---\n![[missing.png]]",
    "utf8"
  );

  const result = runPublisher(root, draftPath, ["-NoCommit", "-NoPush"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Image not found: missing\.png/);
  assert.equal(fs.existsSync(path.join(root, "_posts", "2026-05-06-missing-image.md")), false);
});

test("publishing stops when the site build fails", (t) => {
  const root = makePublisherRoot(t);
  const draftPath = path.join(root, "build-failure.md");
  fs.writeFileSync(draftPath, "---\ntitle: Build failure\nslug: build-failure\n---\nbody", "utf8");
  fs.writeFileSync(path.join(root, "npm.cmd"), "@exit /b 23\r\n", "utf8");

  const result = runPublisher(root, draftPath, ["-NoCommit"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Site build failed with exit code 23/);
});

test("formal publishing commits only generated post paths", (t) => {
  const root = makePublisherRoot(t);
  fs.writeFileSync(path.join(root, "npm.cmd"), "@exit /b 0\r\n", "utf8");
  fs.writeFileSync(path.join(root, "notes.txt"), "initial", "utf8");
  spawnSync("git", ["init"], { cwd: root });
  spawnSync("git", ["add", "."], { cwd: root });
  spawnSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "initial"], { cwd: root });
  fs.writeFileSync(path.join(root, "notes.txt"), "unrelated change", "utf8");

  const draftPath = path.join(root, "draft.md");
  fs.writeFileSync(
    draftPath,
    "---\ntitle: Scoped publish\ndate: 2026-05-06 20:00:00 +0800\nslug: scoped-publish\n---\nbody",
    "utf8"
  );
  const result = runPublisher(root, draftPath, ["-NoPush"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const committed = spawnSync("git", ["show", "--pretty=format:", "--name-only", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  }).stdout.trim().split(/\r?\n/).filter(Boolean);
  assert.deepEqual(committed.sort(), [
    "_posts/2026-05-06-scoped-publish.md",
    "obsidian/Published/draft.md"
  ]);
  assert.match(spawnSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }).stdout, /notes\.txt/);
});
