function splitFrontMatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { yaml: "", body: content };
  }
  return { yaml: match[1], body: match[2] };
}

function readYamlValue(yaml, key) {
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m");
  const match = yaml.match(pattern);
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function writeYamlValue(yaml, key, value) {
  const line = `${key}: ${value}`;
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*.+?$`, "m");
  if (pattern.test(yaml)) {
    return yaml.replace(pattern, line);
  }
  return yaml.trim() ? `${yaml.trimEnd()}\n${line}` : line;
}

function quoteYaml(value) {
  return `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function firstSummary(body) {
  const plain = body
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/[#>*_`\[\]-]/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!plain) return "";
  return plain.length > 80 ? plain.slice(0, 80) : plain;
}

function fileTitle(path) {
  const name = String(path || "新文章.md").split(/[\\/]/).pop().replace(/\.md$/i, "");
  return name || "新文章";
}

function extractMetadata(content, filePath) {
  const { yaml, body } = splitFrontMatter(content);
  const categories = readYamlValue(yaml, "categories") || "[随笔]";
  const categoryMatch = categories.match(/[\[\s,]([^,\]\s]+)[,\]\s]?/);
  const category = categoryMatch ? categoryMatch[1] : "随笔";
  const isMoments = category === "moments";
  const title = readYamlValue(yaml, "title") || (isMoments ? "" : fileTitle(filePath));
  const summary = readYamlValue(yaml, "summary") || (isMoments ? "" : firstSummary(body));

  return { title, summary, category };
}

function applyMetadata(content, metadata) {
  const { yaml, body } = splitFrontMatter(content);
  let nextYaml = yaml;
  const isMoments = metadata.category === "moments";
  if (!isMoments && metadata.title) {
    nextYaml = writeYamlValue(nextYaml, "title", quoteYaml(metadata.title));
  }
  nextYaml = writeYamlValue(nextYaml, "categories", `[${metadata.category}]`);
  if (!isMoments && metadata.summary) {
    nextYaml = writeYamlValue(nextYaml, "summary", quoteYaml(metadata.summary));
  }
  return `---\n${nextYaml.trim()}\n---\n\n${body.trimStart()}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  applyMetadata,
  extractMetadata,
  firstSummary,
  splitFrontMatter
};
