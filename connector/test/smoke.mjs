// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
// Live smoke test. Requires USPTO_ODP_API_KEY in the environment and network
// access to api.uspto.gov, so it is not run in CI.
// Run: node --env-file=../.env test/smoke.mjs   (key in the repository's .env)
//  or: node test/smoke.mjs                       (key already in the environment)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import zlib from "node:zlib";

const here = path.dirname(fileURLToPath(import.meta.url));
// --bundle runs the same tests against the committed single file bundle
// (dist/patent-connector.mjs, made by npm run build) instead of index.js.
const SERVER = process.argv.includes("--bundle")
  ? path.join(here, "..", "dist", "patent-connector.mjs")
  : path.join(here, "..", "index.js");
console.log("Server under test: " + path.relative(path.join(here, ".."), SERVER));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [SERVER],
  env: { ...process.env },
});
const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(transport);

let failures = 0;
const check = (label, cond, extra = "") => {
  console.log((cond ? "PASS " : "FAIL ") + label + (extra ? "  " + extra : ""));
  if (!cond) failures++;
};
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content?.[0]?.text ?? "";
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { isError: !!r.isError, text, json, content: r.content || [] };
};

// Checks the PNG signature and header, and that the image data inflates to
// exactly the expected size. Returns { width, height, depth } or null.
function pngInfo(b64) {
  const buf = Buffer.from(b64, "base64");
  if (!buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return null;
  let p = 8;
  let ihdr = null;
  const idat = [];
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], bytes: buf.length };
    if (type === "IDAT") idat.push(data);
    if (type === "IEND") break;
    p += 12 + len;
  }
  if (!ihdr) return null;
  try {
    const raw = zlib.inflateSync(Buffer.concat(idat));
    return raw.length === (Math.ceil((ihdr.width * ihdr.depth) / 8) + 1) * ihdr.height ? ihdr : null;
  } catch {
    return null;
  }
}

// Discover test subjects at run time so the suite does not depend on any one
// application staying unchanged at USPTO. Fixed numbers are the fallback.
const FALLBACK = { granted: "18483359", withClaims: "19809499" };
const MAX_PROBES = 6;

async function textCodes(appNo) {
  const r = await call("get_patent_documents", { applicationNumber: appNo });
  if (r.isError || !r.json) return null;
  const codes = new Set(r.json.documents.filter((d) => d.textAvailable).map((d) => d.code));
  return { codes, fewerShown: r.json.shown < r.json.totalDocuments };
}

async function discover(searchArgs, accept) {
  const r = await call("search_patents", { limit: MAX_PROBES, ...searchArgs });
  if (r.isError || !r.json?.results) return null;
  for (const item of r.json.results.slice(0, MAX_PROBES)) {
    const info = await textCodes(item.applicationNumber);
    if (info && accept(item, info)) return item.applicationNumber;
  }
  return null;
}

const granted =
  (await discover(
    { query: "data isolation", matchMode: "phrase", grantedOnly: true, sort: "newest" },
    (item, info) => item.patentNumber && info.codes.has("CLM") && info.codes.has("ABST")
  )) || FALLBACK.granted;
const withClaims =
  (await discover(
    { query: "battery electrode", sort: "newest", filingDateFrom: "2023-01-01" },
    (item, info) => info.codes.has("CLM") && info.fewerShown
  )) || FALLBACK.withClaims;
console.log("Using granted application " + granted + (granted === FALLBACK.granted ? " (fallback)" : " (discovered)") +
  " and claims application " + withClaims + (withClaims === FALLBACK.withClaims ? " (fallback)" : " (discovered)"));
// Formatted the way people type it, to exercise number normalization.
const grantedFormatted = granted.length === 8 ? granted.slice(0, 2) + "/" + granted.slice(2, 5) + "," + granted.slice(5) : granted;

const { tools } = await client.listTools();
check("5 tools listed", tools.length === 5 && tools.some((t) => t.name === "get_drawings"), tools.map((t) => t.name).join(", "));
check("all tools annotated read only", tools.every((t) => t.annotations?.readOnlyHint === true && t.annotations?.title));

let r = await call("search_patents", { query: "data isolation", limit: 3 });
check("search all words", !r.isError && r.json.totalMatches > 0 && r.json.totalMatches < 100000, "matches=" + r.json?.totalMatches);

r = await call("search_patents", { query: "data isolation", matchMode: "phrase", limit: 3 });
check("search phrase", !r.isError && r.json.results.length > 0, "matches=" + r.json?.totalMatches);

r = await call("search_patents", { query: "data isolation", matchMode: "phrase", filingDateFrom: "2020-01-01", filingDateTo: "2022-12-31", sort: "oldest", limit: 5 });
const inRange = r.json?.results?.every((x) => x.filingDate >= "2020-01-01" && x.filingDate <= "2022-12-31");
check("date filter applied", !r.isError && inRange && r.json.results.length > 0, "matches=" + r.json?.totalMatches);

r = await call("search_patents", { query: "data isolation", matchMode: "phrase", grantedOnly: true, limit: 5 });
check("granted only", !r.isError && r.json.results.length > 0 && r.json.results.every((x) => x.patentNumber), "matches=" + r.json?.totalMatches);

r = await call("search_patents", { query: "zzqqxxnonexistentterm", limit: 3 });
check("no results is not an error", !r.isError && r.json.totalMatches === 0);

r = await call("get_patent", { applicationNumber: grantedFormatted });
check("get_patent summary", !r.isError && r.json.patentNumber && r.json.inventors?.length > 0, r.json?.title);

r = await call("get_patent", { applicationNumber: "abc" });
check("bad app number rejected locally", r.isError && /not a valid/.test(r.text));

r = await call("get_patent_documents", { applicationNumber: withClaims });
check("key documents", !r.isError && r.json.shown < r.json.totalDocuments && r.json.documents.some((d) => d.code === "CLM"), r.json && r.json.shown + "/" + r.json.totalDocuments);

r = await call("get_document_text", { applicationNumber: withClaims, documentCode: "CLM", maxChars: 2000 });
check("claims text", !r.isError && r.json.text.length > 500 && !/<uscom:/.test(r.json.text), "chars=" + r.json?.totalChars);
if (r.json?.text) console.log("  sample: " + r.json.text.slice(0, 300).replace(/\n/g, " | "));

check("no image metadata in text", r.json && !/\.svg|Black and white/i.test(r.json.text));

r = await call("get_document_text", { applicationNumber: granted, documentCode: "CLM", maxChars: 1500 });
check("claims text, granted patent", !r.isError && /claim/i.test(r.json.text), "chars=" + r.json?.totalChars);
if (r.json?.text) console.log("  sample: " + r.json.text.slice(0, 300).replace(/\n/g, " | "));

r = await call("get_document_text", { applicationNumber: granted, documentCode: "ABST" });
check("abstract text", !r.isError && r.json.text.length > 100, "chars=" + r.json?.totalChars);

r = await call("get_document_text", { applicationNumber: withClaims, documentCode: "DRW" });
check("drawings explain no text", r.isError && /no DRW document with text|scanned/.test(r.text));

// Patent number lookup: US 12,399,789 is application 18483359 (verified at USPTO).
r = await call("get_patent", { patentNumber: "12,399,789" });
check("patentNumber 12,399,789 resolves to 18483359", !r.isError && r.json.applicationNumber === "18483359" && /resolved to application 18483359/.test(r.json.patentNumberLookup || ""), r.json?.patentNumberLookup || r.text);

r = await call("get_patent", { patentNumber: "US 12,399,789 B1" });
check("patentNumber with US prefix and kind code", !r.isError && r.json.applicationNumber === "18483359", r.text.slice(0, 200));

r = await call("get_patent_documents", { patentNumber: "US12399789" });
check("get_patent_documents by patent number lists drawings", !r.isError && r.json.documents.some((d) => d.code === "DRW" || d.code === "DRW.NONBW"), r.text.slice(0, 200));

r = await call("get_patent", { patentNumber: "99999999" });
check("unknown patent number: plain English not found", r.isError && /No USPTO application with patent number/.test(r.text), r.text.slice(0, 200));

// Drawings as images.
r = await call("get_drawings", { applicationNumber: "18483359" });
let images = r.content.filter((c) => c.type === "image");
let infos = images.map((i) => pngInfo(i.data));
check("get_drawings returns text then PNG images", !r.isError && r.content[0]?.type === "text" && images.length >= 1 && images.length <= 3 && images.every((i) => i.mimeType === "image/png"), r.text.slice(0, 300));
check("every drawing image is a valid PNG, longest side 1600", infos.length > 0 && infos.every((i) => i && Math.max(i.width, i.height) <= 1600), JSON.stringify(infos));
console.log("  drawings: " + (r.json ? r.json.documentId + ", " + r.json.totalPages + " pages, " : "") + infos.map((i) => i && i.width + "x" + i.height + " " + i.bytes + " bytes").join("; "));

r = await call("get_drawings", { patentNumber: "12,399,789", pages: "2", maxDimension: 800 });
images = r.content.filter((c) => c.type === "image");
infos = images.map((i) => pngInfo(i.data));
check("get_drawings by patent number, one page at 800 px", !r.isError && images.length === 1 && infos[0] && Math.max(infos[0].width, infos[0].height) === 800 && /18483359/.test(r.json?.patentNumberLookup || ""), r.text.slice(0, 300));

r = await call("get_drawings", { applicationNumber: "18483359", pages: "99" });
check("get_drawings page out of range", r.isError && /does not exist/.test(r.text), r.text.slice(0, 200));

// A patent whose drawings are CCITT Group 4 fax images (the common case).
r = await call("get_drawings", { patentNumber: "10,706,165", pages: "1", maxDimension: 800 });
{
  const faxImages = r.content.filter((c) => c.type === "image");
  const faxInfo = faxImages.map((i) => pngInfo(i.data));
  check("get_drawings on a fax compressed patent (US 10,706,165) shows the page", !r.isError && faxImages.length === 1 && faxInfo[0] && Math.max(faxInfo[0].width, faxInfo[0].height) === 800 && !(r.json?.unreadablePages?.length), r.text.slice(0, 200));
}

await client.close();
console.log(failures ? "\n" + failures + " FAILED" : "\nALL PASSED");
process.exit(failures ? 1 : 0);
