const assert = require("node:assert/strict");
const { test } = require("node:test");
const { parseArgs } = require("../scripts/obsidian-publish");

test("parses publish draft arguments", () => {
  const options = parseArgs([
    "--draft",
    "obsidian/Drafts/demo.md",
    "--cover",
    "C:\\Users\\28068\\Pictures\\cover.png",
    "--cover-position",
    "32% 48%",
    "--date",
    "2026-05-06 20:00:00 +0800",
    "--slug",
    "ml",
    "--no-commit",
    "--no-push",
    "--skip-tests"
  ]);

  assert.equal(options.draft, "obsidian/Drafts/demo.md");
  assert.equal(options.cover, "C:\\Users\\28068\\Pictures\\cover.png");
  assert.equal(options.coverPosition, "32% 48%");
  assert.equal(options.date, "2026-05-06 20:00:00 +0800");
  assert.equal(options.slug, "ml");
  assert.equal(options.noCommit, true);
  assert.equal(options.noPush, true);
  assert.equal(options.skipTests, true);
});

test("defaults to full publish mode", () => {
  const options = parseArgs(["--draft", "obsidian/Drafts/demo.md"]);

  assert.equal(options.draft, "obsidian/Drafts/demo.md");
  assert.equal(options.cover, "");
  assert.equal(options.coverPosition, "50% 50%");
  assert.equal(options.date, "");
  assert.equal(options.slug, "");
  assert.equal(options.noCommit, false);
  assert.equal(options.noPush, false);
  assert.equal(options.skipTests, false);
});
