#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const WEBP_QUALITY = 80;
const MAX_WIDTH = 2000;

const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

async function convertToWebp(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) return null;

  const stat = fs.statSync(filePath);
  const webpPath = filePath.replace(/\.(png|jpe?g)$/i, ".webp");
  const buffer = fs.readFileSync(filePath);

  await sharp(buffer)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(webpPath);

  const originalSize = stat.size;
  const compressedSize = fs.statSync(webpPath).size;
  const ratio = originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(1) : "0";

  // Delete original after successful conversion
  fs.unlinkSync(filePath);

  return {
    original: path.basename(filePath),
    compressed: path.basename(webpPath),
    originalSize,
    compressedSize,
    ratio
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dirIndex = args.indexOf("--dir");
  if (dirIndex === -1 || !args[dirIndex + 1]) {
    console.error("Usage: node compress-images.js --dir <asset-directory>");
    process.exit(1);
  }

  const dir = path.resolve(args[dirIndex + 1]);
  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir);
  const results = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    if (!fs.statSync(filePath).isFile()) continue;

    try {
      const result = await convertToWebp(filePath);
      if (result) results.push(result);
    } catch (error) {
      console.error(`Failed to compress ${file}: ${error.message}`);
    }
  }

  if (results.length === 0) {
    console.log("No images needed compression.");
  } else {
    console.log(`Compressed ${results.length} image(s):`);
    for (const r of results) {
      const origKB = (r.originalSize / 1024).toFixed(0);
      const compKB = (r.compressedSize / 1024).toFixed(0);
      console.log(`  ${r.original} → ${r.compressed}  (${origKB}KB → ${compKB}KB, -${r.ratio}%)`);
    }
  }

  // Output JSON mapping for script consumption
  const mapping = {};
  for (const r of results) {
    mapping[r.original] = r.compressed;
  }
  console.log("__MAPPING__" + JSON.stringify(mapping));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
