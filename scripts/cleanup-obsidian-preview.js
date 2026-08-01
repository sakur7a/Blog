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

function removeNewUntrackedFiles(root, relativePath, preservePaths) {
  const result = runGit(root, ["ls-files", "--others", "--exclude-standard", "--", relativePath]);
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Failed to inspect ${relativePath}`);
  }

  for (const untracked of result.stdout.split(/\r?\n/).filter(Boolean)) {
    const normalized = normalizeManifestPath(root, untracked);
    if (!preservePaths.has(normalized.relative) && fs.existsSync(normalized.fullPath)) {
      fs.rmSync(normalized.fullPath, { recursive: true, force: true });
    }
  }
}

function restoreOrRemove(root, relativePath, preservePaths = new Set()) {
  const { fullPath, relative } = normalizeManifestPath(root, relativePath);
  if (isTracked(root, relative)) {
    const result = runGit(root, ["restore", "--", relative]);
    if (result.status !== 0) {
      throw new Error(result.stderr.trim() || `Failed to restore ${relative}`);
    }
    removeNewUntrackedFiles(root, relative, preservePaths);
    return;
  }

  if (!fs.existsSync(fullPath)) return;
  fs.rmSync(fullPath, { recursive: true, force: true });
}

function cleanupPreview(root = path.resolve(__dirname, "..")) {
  const manifestPath = path.join(root, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) {
    return { cleaned: false, message: "No preview manifest found." };
  }

  const manifestContent = fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "");
  const manifest = JSON.parse(manifestContent);
  const manifestPaths = Array.isArray(manifest.paths) ? manifest.paths : [manifest.paths].filter(Boolean);
  const preserved = Array.isArray(manifest.preservePaths) ? manifest.preservePaths : [manifest.preservePaths].filter(Boolean);
  const paths = Array.from(new Set(manifestPaths));
  const preservePaths = new Set(
    preserved.map((relativePath) => normalizeManifestPath(root, relativePath).relative)
  );

  for (const relativePath of paths.sort((a, b) => b.length - a.length)) {
    restoreOrRemove(root, relativePath, preservePaths);
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
