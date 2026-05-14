#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function normalizePostPath(root, postPath) {
  if (!postPath || path.isAbsolute(postPath)) {
    throw new Error(`Post path must be inside _posts: ${postPath}`);
  }

  const fullPath = path.resolve(root, postPath);
  const relative = path.relative(root, fullPath).replace(/\\/g, "/");
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.startsWith("_posts/") || !relative.endsWith(".md")) {
    throw new Error(`Post path must be inside _posts: ${postPath}`);
  }
  return { fullPath, relative };
}

function assetPathForPost(relativePostPath) {
  const fileName = path.basename(relativePostPath, ".md");
  return `assets/images/posts/${fileName}`;
}

function run(root, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
    shell: options.shell || false
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  }
  return result;
}

function deletePost(root = path.resolve(__dirname, ".."), postPath, options = {}) {
  const { fullPath, relative } = normalizePostPath(root, postPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Post does not exist: ${relative}`);
  }

  const removed = [];
  const assetRelative = assetPathForPost(relative);
  const assetFullPath = path.join(root, assetRelative);
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), "blog-delete-backup-"));
  const postBackup = path.join(backupRoot, "post.md");
  const assetBackup = path.join(backupRoot, "assets");
  fs.copyFileSync(fullPath, postBackup);
  if (options.deleteAssets && fs.existsSync(assetFullPath)) {
    fs.cpSync(assetFullPath, assetBackup, { recursive: true });
  }

  try {
    fs.rmSync(fullPath, { force: true });
    removed.push(relative);

    if (options.deleteAssets && fs.existsSync(assetFullPath)) {
      fs.rmSync(assetFullPath, { recursive: true, force: true });
      removed.push(assetRelative);
    }

    if (!options.skipBuild) {
      run(root, "npm", ["run", "build"], { inherit: true, shell: true });
      if (!options.skipTests) {
        run(root, "npm", ["run", "test:e2e"], { inherit: true, shell: true });
      }
    }

    if (!options.noCommit) {
      run(root, "git", ["add", "_posts", "assets/images"], { inherit: true });
      const status = spawnSync("git", ["status", "--short"], { cwd: root, encoding: "utf8", shell: false });
      if (status.stdout.trim()) {
        run(root, "git", ["commit", "-m", `post: delete ${path.basename(relative, ".md")}`], { inherit: true });
        if (!options.noPush) {
          run(root, "git", ["-c", "http.sslBackend=openssl", "push", "origin", "main"], { inherit: true });
        }
      }
    }

    return { removed };
  } catch (error) {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.copyFileSync(postBackup, fullPath);
    if (options.deleteAssets && fs.existsSync(assetBackup)) {
      fs.rmSync(assetFullPath, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(assetFullPath), { recursive: true });
      fs.cpSync(assetBackup, assetFullPath, { recursive: true });
    }
    throw error;
  } finally {
    fs.rmSync(backupRoot, { recursive: true, force: true });
  }
}

function editTags(root = path.resolve(__dirname, ".."), postPath, tagsInput, options = {}) {
  const { fullPath, relative } = normalizePostPath(root, postPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Post does not exist: ${relative}`);
  }

  const content = fs.readFileSync(fullPath, "utf8").replace(/^﻿/, "");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error("No front matter found");

  const yaml = match[1];
  const body = match[2];

  const tags = tagsInput
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const tagsYaml = `[${tags.join(", ")}]`;

  const pattern = /^tags:\s*.+?$/m;
  let nextYaml;
  if (pattern.test(yaml)) {
    nextYaml = yaml.replace(pattern, `tags: ${tagsYaml}`);
  } else {
    nextYaml = yaml.trimEnd() + `\ntags: ${tagsYaml}`;
  }

  const nextContent = `---\n${nextYaml.trim()}\n---\n${body}`;
  fs.writeFileSync(fullPath, nextContent, "utf8");

  if (!options.noCommit) {
    run(root, "git", ["add", relative], { inherit: true });
    run(root, "git", ["commit", "-m", `post: update tags for ${path.basename(relative, ".md")}`], { inherit: true });
    if (!options.noPush) {
      run(root, "git", ["-c", "http.sslBackend=openssl", "push", "origin", "main"], { inherit: true });
    }
  }

  return { postPath: relative, tags };
}

function parseArgs(argv) {
  const options = {
    command: argv[0] || "",
    post: "",
    tags: "",
    deleteAssets: false,
    noCommit: false,
    noPush: false,
    skipBuild: false,
    skipTests: false
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--post") {
      options.post = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--assets") {
      options.deleteAssets = true;
    } else if (arg === "--no-commit") {
      options.noCommit = true;
    } else if (arg === "--no-push") {
      options.noPush = true;
    } else if (arg === "--skip-build") {
      options.skipBuild = true;
    } else if (arg === "--skip-tests") {
      options.skipTests = true;
    } else if (arg === "--tags") {
      options.tags = argv[index + 1] || "";
      index += 1;
    }
  }

  return options;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.command === "delete") {
      const result = deletePost(path.resolve(__dirname, ".."), options.post, options);
      process.stdout.write(JSON.stringify(result, null, 2));
    } else if (options.command === "edit-tags") {
      const result = editTags(path.resolve(__dirname, ".."), options.post, options.tags || "", options);
      process.stdout.write(JSON.stringify(result, null, 2));
    } else {
      throw new Error("Usage: node scripts/manage-post.js <delete|edit-tags> --post _posts/YYYY-MM-DD-slug.md");
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  assetPathForPost,
  deletePost,
  editTags,
  normalizePostPath,
  parseArgs
};
