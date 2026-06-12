#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

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

function firstParagraph(body) {
  const plain = String(body)
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/[#>*_`\[\]-]/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!plain) return "";
  return plain.length > 80 ? plain.slice(0, 80) : plain;
}

function readConfig(root) {
  const configPath = path.join(root, "_config.yml");
  if (!fs.existsSync(configPath)) return {};
  const yaml = fs.readFileSync(configPath, "utf8");
  return {
    baseUrl: readYamlValue(yaml, "url"),
    basePath: readYamlValue(yaml, "baseurl")
  };
}

function categoryFromYaml(yaml) {
  const categories = readYamlValue(yaml, "categories") || "[随笔]";
  const match = categories.match(/[\[\s,]([^,\]\s]+)[,\]\s]?/);
  return match ? match[1] : "随笔";
}

function postInfo(root, fileName, options = {}) {
  const fullPath = path.join(root, "_posts", fileName);
  const content = fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "");
  const { yaml, body } = splitFrontMatter(content);
  const dateSlug = fileName.replace(/\.md$/i, "");
  const match = dateSlug.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/);
  const year = match ? match[1] : "";
  const month = match ? match[2] : "";
  const day = match ? match[3] : "";
  const slug = match ? match[4] : dateSlug;
  const title = readYamlValue(yaml, "title") || slug;
  const dateValue = readYamlValue(yaml, "date") || `${year}-${month}-${day}`;
  const summary = readYamlValue(yaml, "summary") || firstParagraph(body);
  const category = categoryFromYaml(yaml);
  const cover = readYamlValue(yaml, "cover");
  const coverPosition = readYamlValue(yaml, "cover_position");
  const postPath = `_posts/${fileName}`;
  const assetPath = `assets/images/posts/${dateSlug}`;
  const sourceName = `${title}.md`;
  const sourcePath = fs.existsSync(path.join(root, "obsidian", "Published", sourceName))
    ? `obsidian/Published/${sourceName}`
    : "";
  const baseUrl = (options.baseUrl || "").replace(/\/$/, "");
  const basePath = options.basePath || "";
  const relativeUrl = `/${year}-${month}-${day}/${slug}.html`;
  const url = `${baseUrl}${basePath}${relativeUrl}`;

  return {
    title,
    date: `${year}-${month}-${day}`,
    dateValue,
    category,
    summary,
    slug,
    cover,
    coverPosition,
    postPath,
    assetPath,
    sourcePath,
    url,
    relativeUrl: `${basePath}${relativeUrl}`
  };
}

function listPosts(root = path.resolve(__dirname, ".."), options = {}) {
  const config = readConfig(root);
  const mergedOptions = {
    baseUrl: options.baseUrl ?? config.baseUrl ?? "",
    basePath: options.basePath ?? config.basePath ?? ""
  };
  const postsDir = path.join(root, "_posts");
  if (!fs.existsSync(postsDir)) return [];
  return fs.readdirSync(postsDir)
    .filter((fileName) => /\.md$/i.test(fileName))
    .sort()
    .reverse()
    .map((fileName) => postInfo(root, fileName, mergedOptions));
}

if (require.main === module) {
  const posts = listPosts();
  process.stdout.write(JSON.stringify(posts, null, 2));
}

module.exports = {
  listPosts,
  postInfo,
  splitFrontMatter,
  readYamlValue
};
