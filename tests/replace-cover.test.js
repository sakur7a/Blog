const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { replaceCover } = require("../scripts/replace-cover");
const { listPosts } = require("../scripts/list-posts");

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-cover-"));
  fs.mkdirSync(path.join(root, "_posts"), { recursive: true });
  fs.mkdirSync(path.join(root, "assets", "images", "posts"), { recursive: true });
  return root;
}

test("replaceCover updates front matter and copies image", () => {
  const root = makeRoot();
  const postPath = path.join(root, "_posts", "2026-05-06-ml.md");
  const assetDir = path.join(root, "assets", "images", "posts", "2026-05-06-ml");
  fs.mkdirSync(assetDir, { recursive: true });
  fs.writeFileSync(path.join(assetDir, "cover.png"), "old-image", "utf8");
  fs.writeFileSync(
    postPath,
    [
      "---",
      'title: "ML"',
      "date: 2026-05-06",
      'cover: "/assets/images/posts/2026-05-06-ml/cover.png"',
      'cover_position: "30% 45%"',
      "---",
      "",
      "正文"
    ].join("\n"),
    "utf8"
  );

  const newCover = path.join(root, "new-cover.jpg");
  fs.writeFileSync(newCover, "new-image-data", "utf8");

  const result = replaceCover(root, "_posts/2026-05-06-ml.md", newCover, {
    noCommit: true,
    noPush: true,
    skipBuild: true
  });

  assert.equal(result.postPath, "_posts/2026-05-06-ml.md");
  assert.equal(result.cover, "/assets/images/posts/2026-05-06-ml/cover.jpg");

  // Old cover removed, new cover exists
  assert.equal(fs.existsSync(path.join(assetDir, "cover.png")), false);
  assert.equal(fs.existsSync(path.join(assetDir, "cover.jpg")), true);

  // Front matter updated
  const content = fs.readFileSync(postPath, "utf8");
  assert.ok(content.includes('cover: "/assets/images/posts/2026-05-06-ml/cover.jpg"'));
  assert.ok(content.includes('cover_position: "30% 45%"'));
});

test("replaceCover sets default cover_position when missing", () => {
  const root = makeRoot();
  const postPath = path.join(root, "_posts", "2026-05-06-hello.md");
  fs.writeFileSync(
    postPath,
    ["---", 'title: "Hello"', "date: 2026-05-06", "---", "", "正文"].join("\n"),
    "utf8"
  );

  const newCover = path.join(root, "cover.png");
  fs.writeFileSync(newCover, "img", "utf8");

  replaceCover(root, "_posts/2026-05-06-hello.md", newCover, {
    noCommit: true,
    noPush: true,
    skipBuild: true
  });

  const content = fs.readFileSync(postPath, "utf8");
  assert.ok(content.includes('cover: "/assets/images/posts/2026-05-06-hello/cover.png"'));
  assert.ok(content.includes('cover_position: "50% 50%"'));
});

test("listPosts includes cover field", () => {
  const root = makeRoot();
  fs.writeFileSync(
    path.join(root, "_posts", "2026-05-06-ml.md"),
    [
      "---",
      'title: "ML"',
      "date: 2026-05-06",
      'cover: "/assets/images/posts/2026-05-06-ml/cover.png"',
      "---",
      "",
      "正文"
    ].join("\n"),
    "utf8"
  );

  const posts = listPosts(root);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].cover, "/assets/images/posts/2026-05-06-ml/cover.png");
});

test("listPosts cover field is empty when not set", () => {
  const root = makeRoot();
  fs.writeFileSync(
    path.join(root, "_posts", "2026-05-06-test.md"),
    ["---", 'title: "Test"', "date: 2026-05-06", "---", "", "正文"].join("\n"),
    "utf8"
  );

  const posts = listPosts(root);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].cover, "");
});

test("replaceCover rejects unsupported image types", () => {
  const root = makeRoot();
  const postPath = path.join(root, "_posts", "2026-05-06-test.md");
  fs.writeFileSync(postPath, "---\ntitle: Test\n---\n", "utf8");

  const badCover = path.join(root, "cover.bmp");
  fs.writeFileSync(badCover, "img", "utf8");

  assert.throws(
    () => replaceCover(root, "_posts/2026-05-06-test.md", badCover, { noCommit: true, noPush: true, skipBuild: true }),
    /Unsupported cover image type/
  );
});
