#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const MANIFEST_NAME = ".obsidian-preview.json";

function normalizeManifestPath(root, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error(`Unsafe preview path: ${relativePath}`);
  }

  const fullPath = path.resolve(root, relativePath);
  const relative = path.relative(root, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Preview path escapes blog root: ${relativePath}`);
  }

  return { fullPath, relative: relative.replace(/\\/g, "/") };
}

function runGit(root, args) {
  return spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    shell: false
  });
}

function isTracked(root, relativePath) {
  const result = runGit(root, ["ls-files", "--error-unmatch", "--", relativePath]);
  return result.status === 0;
}

function restoreOrRemove(root, relativePath) {
  const { fullPath, relative } = normalizeManifestPath(root, relativePath);
  if (!fs.existsSync(fullPath)) return;

  if (isTracked(root, relative)) {
    const result = runGit(root, ["restore", "--", relative]);
    if (result.status !== 0) {
      throw new Error(result.stderr.trim() || `Failed to restore ${relative}`);
    }
    return;
  }

  fs.rmSync(fullPath, { recursive: true, force: true });
}

function cleanupPreview(root = path.resolve(__dirname, "..")) {
  const manifestPath = path.join(root, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) {
    return { cleaned: false, message: "No preview manifest found." };
  }

  const manifestContent = fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "");
  const manifest = JSON.parse(manifestContent);
  const paths = Array.from(new Set(manifest.paths || []));

  for (const relativePath of paths.sort((a, b) => b.length - a.length)) {
    restoreOrRemove(root, relativePath);
  }

  fs.rmSync(manifestPath, { force: true });
  if (fs.existsSync(path.join(root, "Gemfile"))) {
    spawnSync("bundle", ["exec", "jekyll", "clean"], {
      cwd: root,
      stdio: "inherit",
      shell: true
    });
  }

  return { cleaned: true, paths };
}

if (require.main === module) {
  try {
    const result = cleanupPreview();
    console.log(result.cleaned ? "Cleaned last Obsidian preview." : result.message);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  cleanupPreview,
  normalizeManifestPath
};
