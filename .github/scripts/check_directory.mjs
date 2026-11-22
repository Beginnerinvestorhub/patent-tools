// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
//
// Checks a directory build (.github/scripts/build_directory.sh) against the
// Claude plugin directory's rules for organizations that are not Verified,
// so a refused file is caught here instead of in review:
//
//   node .github/scripts/check_directory.mjs BUILD_DIR
//
// Exits 1 and lists every problem found.
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: check_directory.mjs BUILD_DIR");
  process.exit(2);
}

const TEXT_EXT = new Set([".md", ".txt", ".json", ".yaml", ".yml"]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const TEXT_NAMES = new Set(["LICENSE", "NOTICE"]);
const REFUSED_NAMES = new Set([
  ".mcp.json", "hooks.json", ".lsp.json", "monitors.json", "package.json",
  "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
  "yarn.lock", "requirements.txt", "pyproject.toml", "Pipfile", "Pipfile.lock",
  "poetry.lock", "uv.lock", ".npmrc", ".yarnrc", ".yarnrc.yml", "pip.conf",
]);
const PLUGIN_FIELDS = new Set([
  "name", "version", "description", "author", "repository", "homepage",
  "license", "icon", "privacyPolicyUrl", "keywords",
]);
const MAX_TEXT_BYTES = 256 * 1024;
const MAX_FILES = 512;
// Install commands and package manager configuration. The directory refuses
// these even in documentation from organizations that are not Verified.
const INSTALL_LINE = /\b(pip3?|pipx|uv|npm|npx|pnpm|yarn|bun|brew|apt(-get)?|gem|cargo|go)\s+(install|add|config|exec|dlx|run)\b|\bnpx\s+-y\b|\b(curl|wget)\b[^\n]*\|\s*(ba|z)?sh\b|--index-url|--extra-index-url|registry\s*=/i;
// Leftovers from the full edition that would send Claude looking for
// files this edition does not have.
const FULL_EDITION = /scripts\/|\.py\b|build_pdf|check_drawing|check_numerals|brief_description|Patent Connector|mcp__|connector\//;

const problems = [];
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(path.relative(root, full).split(path.sep).join("/"));
  }
})(root);

if (files.length > MAX_FILES) problems.push(`${files.length} files; the limit is ${MAX_FILES}`);

for (const rel of files) {
  const name = path.posix.basename(rel);
  const ext = path.posix.extname(name).toLowerCase();
  const bytes = fs.readFileSync(path.join(root, rel));

  if (!/^[A-Za-z0-9._\/-]+$/.test(rel)) problems.push(`${rel}: path has characters not every computer keeps`);
  if (REFUSED_NAMES.has(name)) problems.push(`${rel}: package manager, MCP or hook file`);
  if (rel.startsWith(".claude/") || rel.includes("/.claude/")) problems.push(`${rel}: .claude folder`);
  if (rel.startsWith(".claude-plugin/") && name !== "plugin.json" && !IMAGE_EXT.has(ext)) {
    problems.push(`${rel}: only plugin.json and images belong in .claude-plugin`);
  }
  if (rel.includes(".claude-plugin/") && !rel.startsWith(".claude-plugin/")) {
    problems.push(`${rel}: a second .claude-plugin folder`);
  }

  if (IMAGE_EXT.has(ext)) {
    if (ext === ".png" && !bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      problems.push(`${rel}: not a PNG file`);
    }
    if (bytes.includes(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) problems.push(`${rel}: image looks like it holds a zip archive`);
    continue;
  }
  if (!TEXT_EXT.has(ext) && !TEXT_NAMES.has(name)) {
    problems.push(`${rel}: only Markdown, text, JSON, YAML and PNG, JPEG, GIF or WebP images are accepted`);
    continue;
  }

  if (bytes.length > MAX_TEXT_BYTES) problems.push(`${rel}: text file over 256 KB`);
  if (bytes.includes(0)) problems.push(`${rel}: NUL byte`);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    problems.push(`${rel}: not valid UTF-8`);
    continue;
  }
  if (text.startsWith("﻿")) problems.push(`${rel}: starts with a byte order mark`);
  if (text.startsWith("#!")) problems.push(`${rel}: starts with #!`);
  text.split("\n").forEach((line, i) => {
    if (INSTALL_LINE.test(line)) problems.push(`${rel}:${i + 1}: install or package manager command: ${line.trim()}`);
    if (FULL_EDITION.test(line)) problems.push(`${rel}:${i + 1}: refers to a full edition file or tool: ${line.trim()}`);
  });
}

const manifestPath = path.join(root, ".claude-plugin", "plugin.json");
if (!fs.existsSync(manifestPath)) {
  problems.push(".claude-plugin/plugin.json is missing");
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const key of Object.keys(manifest)) {
    if (!PLUGIN_FIELDS.has(key)) problems.push(`plugin.json: field "${key}" is not accepted`);
  }
  if (manifest.icon && !files.includes(manifest.icon)) problems.push(`plugin.json: icon ${manifest.icon} is missing`);
}
for (const required of ["README.md", "LICENSE", "skills/patent-drawing/SKILL.md"]) {
  if (!files.includes(required)) problems.push(`${required} is missing`);
}

// Every relative Markdown link in the skill must resolve inside the build.
for (const rel of files.filter((f) => f.endsWith(".md"))) {
  const text = fs.readFileSync(path.join(root, rel), "utf8");
  for (const [, target] of text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(rel), target));
    if (!files.includes(resolved)) problems.push(`${rel}: link to ${target} does not resolve`);
  }
}

if (problems.length) {
  console.error(`directory check: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`directory check: PASS (${files.length} files)`);
