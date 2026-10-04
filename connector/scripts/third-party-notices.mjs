#!/usr/bin/env node
// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
//
// Part of `npm run build`. Reads the esbuild metafile, finds every npm
// package that went into dist/patent-connector.mjs, and writes their names,
// versions, licenses and full license texts to dist/THIRD_PARTY_NOTICES.txt.
// The metafile is deleted afterwards so it is never committed.
//
// Usage: node scripts/third-party-notices.mjs dist/meta.json
import fs from "node:fs";
import path from "node:path";

const metaPath = process.argv[2];
if (!metaPath) {
  console.error("usage: node scripts/third-party-notices.mjs <esbuild metafile>");
  process.exit(2);
}
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

// "node_modules/@scope/name/..." or "node_modules/name/..." -> package folder
const dirs = new Set();
for (const input of Object.keys(meta.inputs)) {
  const m = input.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
  if (m) dirs.add(m[1]);
}

const sections = [];
for (const dir of [...dirs].sort()) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  const licenseFile = fs
    .readdirSync(dir)
    .find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  if (!licenseFile) {
    console.error(`No license file found for ${pkg.name}; add its notice by hand.`);
    process.exit(1);
  }
  const text = fs.readFileSync(path.join(dir, licenseFile), "utf8").trim();
  sections.push(`${pkg.name} ${pkg.version} (${pkg.license})\n${"-".repeat(60)}\n${text}\n`);
}

const out = path.join(path.dirname(metaPath), "THIRD_PARTY_NOTICES.txt");
fs.writeFileSync(
  out,
  "Third party software bundled in patent-connector.mjs\n\n" +
    "patent-connector.mjs is built from index.js (Copyright 2026 Kevin Ringler,\n" +
    "Apache License 2.0) and also contains the following packages, each under\n" +
    "its own license, reproduced in full below.\n\n" +
    sections.join("\n"),
);
fs.rmSync(metaPath, { force: true });
console.log(`Wrote ${out} (${sections.length} packages)`);
