const assert = require("node:assert/strict");
const { test } = require("node:test");
const { parseArgs } = require("../scripts/obsidian-publish");

test("parses publish draft arguments", () => {
  const options = parseArgs([
    "--draft",
    "obsidian/Drafts/demo.md",
    "--no-commit",
    "--no-push",
    "--skip-tests"
  ]);

  assert.equal(options.draft, "obsidian/Drafts/demo.md");
  assert.equal(options.noCommit, true);
  assert.equal(options.noPush, true);
  assert.equal(options.skipTests, true);
});

test("defaults to full publish mode", () => {
  const options = parseArgs(["--draft", "obsidian/Drafts/demo.md"]);

  assert.equal(options.draft, "obsidian/Drafts/demo.md");
  assert.equal(options.noCommit, false);
  assert.equal(options.noPush, false);
  assert.equal(options.skipTests, false);
});
