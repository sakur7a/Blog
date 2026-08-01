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

function isPathInside(parentPath, candidatePath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
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

  // Resolve the old cover only when it is a file inside this post's asset dir.
  const oldCover = readYamlValue(yaml, "cover");
  let oldCoverAbsolute = "";
  if (oldCover) {
    const candidate = path.join(root, oldCover.replace(/^\//, ""));
    if (isPathInside(assetDir, candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      oldCoverAbsolute = candidate;
    }
  }

  // Ensure asset dir exists
  fs.mkdirSync(assetDir, { recursive: true });

  // Copy new cover
  const coverFileName = `cover${coverExtension}`;
  const coverDestRelative = `${assetRelative}/${coverFileName}`;
  const coverDestAbsolute = path.join(root, coverDestRelative);

  // Update front matter
  let newYaml = setYamlValue(yaml, "cover", `"/${coverDestRelative}"`);
  // Use provided position, preserve existing, or set default
  const coverPosition = options.coverPosition || readYamlValue(yaml, "cover_position");
  if (coverPosition) {
    newYaml = setYamlValue(newYaml, "cover_position", `"${coverPosition}"`);
  } else {
    newYaml = setYamlValue(newYaml, "cover_position", '"50% 50%"');
  }

  // Keep exact backups until build/tests pass so a failed replacement cannot
  // leave the article without its previous cover.
  const fileBackups = new Map();
  for (const filePath of [oldCoverAbsolute, coverDestAbsolute].filter(Boolean)) {
    if (!fileBackups.has(filePath)) {
      fileBackups.set(filePath, fs.existsSync(filePath) ? fs.readFileSync(filePath) : null);
    }
  }

  const newContent = `---\n${newYaml}\n---\n${body}`;
  try {
    if (oldCoverAbsolute && oldCoverAbsolute !== coverDestAbsolute) {
      fs.rmSync(oldCoverAbsolute);
    }
    fs.copyFileSync(coverPath, coverDestAbsolute);
    fs.writeFileSync(fullPath, newContent, "utf8");

    if (!options.skipBuild) {
      run(root, "npm", ["run", "build"], { inherit: true, shell: true });
      if (!options.skipTests) {
        run(root, "npm", ["run", "test:e2e"], { inherit: true, shell: true });
      }
    }
  } catch (error) {
    fs.writeFileSync(fullPath, content, "utf8");
    for (const [filePath, backup] of fileBackups) {
      if (backup === null) {
        fs.rmSync(filePath, { force: true });
      } else {
        fs.writeFileSync(filePath, backup);
      }
    }
    throw error;
  }

  if (!options.noCommit) {
    const publishPaths = [relative, assetRelative];
    run(root, "git", ["add", "-A", "--", ...publishPaths], { inherit: true });
    const status = spawnSync("git", ["status", "--short", "--", ...publishPaths], { cwd: root, encoding: "utf8", shell: false });
    if (status.stdout.trim()) {
      const postName = path.basename(relative, ".md");
      run(root, "git", ["commit", "-m", `post: replace cover for ${postName}`, "--", ...publishPaths], { inherit: true });
      if (!options.noPush) {
        run(root, "git", ["-c", "http.sslBackend=openssl", "push", "origin", "HEAD:main"], { inherit: true });
      }
    }
  }

  return { postPath: relative, cover: `/${coverDestRelative}` };
}

function parseArgs(argv) {
  const options = {
    post: "",
    cover: "",
    coverPosition: "",
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
    } else if (arg === "--cover-position") {
      options.coverPosition = argv[index + 1] || "";
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
      throw new Error("Usage: node scripts/replace-cover.js --post _posts/YYYY-MM-DD-slug.md --cover /path/to/image.png [--cover-position 'X% Y%']");
    }
    const result = replaceCover(path.resolve(__dirname, ".."), options.post, options.cover, options);
    process.stdout.write(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { replaceCover, parseArgs };
