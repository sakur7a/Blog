#!/usr/bin/env node
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const options = {
    draft: "",
    cover: "",
    coverPosition: "50% 50%",
    date: "",
    slug: "",
    vaultRoot: "",
    noCommit: false,
    noPush: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--draft") {
      options.draft = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--cover") {
      options.cover = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--cover-position") {
      options.coverPosition = argv[index + 1] || "50% 50%";
      index += 1;
    } else if (arg === "--date") {
      options.date = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--slug" || arg === "--slug-override") {
      options.slug = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--no-commit") {
      options.noCommit = true;
    } else if (arg === "--no-push") {
      options.noPush = true;
    } else if (arg === "--vault-root") {
      options.vaultRoot = argv[index + 1] || "";
      index += 1;
    }
  }

  return options;
}

function runPublisher(options) {
  const root = path.resolve(__dirname, "..");
  const script = path.join(root, "scripts", "publish-obsidian-post.ps1");
  const draftPath = path.resolve(root, options.draft);

  if (!options.draft) {
    throw new Error("Missing --draft path.");
  }

  if (!fs.existsSync(draftPath)) {
    throw new Error(`Draft does not exist: ${draftPath}`);
  }

  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    script,
    draftPath
  ];

  if (options.noCommit) args.push("-NoCommit");
  if (options.noPush) args.push("-NoPush");
  if (options.vaultRoot) args.push("-VaultRoot", options.vaultRoot);
  if (options.date) args.push("-DateOverride", options.date);
  if (options.slug) args.push("-SlugOverride", options.slug);
  if (options.cover) {
    args.push("-CoverPath", path.resolve(root, options.cover));
    args.push("-CoverPosition", options.coverPosition);
  }

  return new Promise((resolve, reject) => {
    const child = spawn("powershell", args, {
      cwd: root,
      stdio: "inherit",
      shell: false
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Publisher exited with code ${code}`));
      }
    });
  });
}

if (require.main === module) {
  runPublisher(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  runPublisher
};
