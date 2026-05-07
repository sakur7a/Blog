#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

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

function splitFrontMatter(content) {
  const match = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { yaml: "", body: content };
  return { yaml: match[1], body: match[2] };
}

function readYamlValue(yaml, key) {
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(.+?)\\s*$`, "m");
  const match = String(yaml).match(pattern);
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function setYamlValue(yaml, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}:\\s*.*$`, "m");
  if (pattern.test(yaml)) {
    return yaml.replace(pattern, `${key}: ${value}`);
  }
  return `${yaml.trimEnd()}\n${key}: ${value}\n`;
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

function replaceCover(root, postPath, coverPath, options = {}) {
  const { fullPath, relative } = normalizePostPath(root, postPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Post does not exist: ${relative}`);
  }

  if (!fs.existsSync(coverPath)) {
    throw new Error(`Cover image does not exist: ${coverPath}`);
  }

  const coverExtension = path.extname(coverPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(coverExtension)) {
    throw new Error(`Unsupported cover image type: ${coverExtension}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
  }

  const assetRelative = assetPathForPost(relative);
  const assetDir = path.join(root, assetRelative);

  // Read post content
  const content = fs.readFileSync(fullPath, "utf8").replace(/^﻿/, "");
  const { yaml, body } = splitFrontMatter(content);
  if (!yaml) {
    throw new Error(`Post has no front matter: ${relative}`);
  }

  // Find and remove old cover file (only if inside the asset dir)
  const oldCover = readYamlValue(yaml, "cover");
  if (oldCover) {
    const oldCoverAbsolute = path.join(root, oldCover.replace(/^\//, ""));
    const resolvedOld = path.resolve(oldCoverAbsolute);
    const resolvedAsset = path.resolve(assetDir);
    if (resolvedOld.startsWith(resolvedAsset) && fs.existsSync(resolvedOld)) {
      fs.rmSync(oldCoverAbsolute);
    }
  }

  // Ensure asset dir exists
  fs.mkdirSync(assetDir, { recursive: true });

  // Copy new cover
  const coverFileName = `cover${coverExtension}`;
  const coverDestRelative = `${assetRelative}/${coverFileName}`;
  fs.copyFileSync(coverPath, path.join(root, coverDestRelative));

  // Update front matter
  let newYaml = setYamlValue(yaml, "cover", `"/${coverDestRelative}"`);
  // Preserve cover_position, set default if missing
  const coverPosition = readYamlValue(yaml, "cover_position");
  if (!coverPosition) {
    newYaml = setYamlValue(newYaml, "cover_position", '"50% 50%"');
  }

  // Write post back
  const newContent = `---\n${newYaml}\n---\n${body}`;
  fs.writeFileSync(fullPath, newContent, "utf8");

  // Build, test, commit, push
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
      const postName = path.basename(relative, ".md");
      run(root, "git", ["commit", "-m", `post: replace cover for ${postName}`], { inherit: true });
      if (!options.noPush) {
        run(root, "git", ["-c", "http.sslBackend=openssl", "push", "origin", "main"], { inherit: true });
      }
    }
  }

  return { postPath: relative, cover: `/${coverDestRelative}` };
}

function parseArgs(argv) {
  const options = {
    post: "",
    cover: "",
    noCommit: false,
    noPush: false,
    skipBuild: false,
    skipTests: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--post") {
      options.post = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--cover") {
      options.cover = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--no-commit") {
      options.noCommit = true;
    } else if (arg === "--no-push") {
      options.noPush = true;
    } else if (arg === "--skip-build") {
      options.skipBuild = true;
    } else if (arg === "--skip-tests") {
      options.skipTests = true;
    }
  }

  return options;
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (!options.post || !options.cover) {
      throw new Error("Usage: node scripts/replace-cover.js --post _posts/YYYY-MM-DD-slug.md --cover /path/to/image.png");
    }
    const result = replaceCover(path.resolve(__dirname, ".."), options.post, options.cover, options);
    process.stdout.write(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { replaceCover, parseArgs };
