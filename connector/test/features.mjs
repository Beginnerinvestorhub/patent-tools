// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
// Offline feature tests: patent number lookup and get_drawings (through the
// server, against a simulated USPTO that serves a real USPTO drawings PDF),
// plus direct tests of the PDF reader and PNG encoder.
// Run: node test/features.mjs   (no API key or network needed)
//      node test/features.mjs --bundle   (server tests against dist/patent-connector.mjs)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import zlib from "node:zlib";
import { PdfDocument, PdfError, UnsupportedImageError, extractPageImage, LIMITS, Stream, Name } from "../lib/pdf.js";
import { downscale, orient, encodePngGray, crc32 } from "../lib/raster.js";
import { buildImagePdf, bilevelScan } from "./pdf-builder.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER = process.argv.includes("--bundle")
  ? path.join(here, "..", "dist", "patent-connector.mjs")
  : path.join(here, "..", "index.js");
console.log("Server under test: " + path.relative(path.join(here, ".."), SERVER));
const FIXTURE = path.join(here, "fixtures", "drw-18483359.pdf");
const KEY = "TEST_KEY_DO_NOT_LEAK_7f3a";
let failures = 0;
let passes = 0;
const check = (label, cond, extra = "") => {
  console.log((cond ? "PASS " : "FAIL ") + label + (!cond && extra ? "  " + String(extra).slice(0, 400) : ""));
  if (cond) passes++;
  else failures++;
};

// ---------------------------------------------------------------------------
// Minimal PNG decoder (grayscale only) to verify what the server returns.
// ---------------------------------------------------------------------------
function decodePng(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) throw new Error("bad PNG signature");
  let p = 8;
  let ihdr = null;
  const idat = [];
  let sawEnd = false;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    const crc = buf.readUInt32BE(p + 8 + len);
    if (crc32(buf.subarray(p + 4, p + 8 + len)) !== crc) throw new Error("bad CRC in " + type);
    if (type === "IHDR") ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] };
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") { sawEnd = true; break; }
    p += 12 + len;
  }
  if (!ihdr || !sawEnd) throw new Error("missing IHDR or IEND");
  if (ihdr.colorType !== 0 || ihdr.interlace !== 0) throw new Error("unexpected color type");
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rowBytes = Math.ceil((ihdr.width * ihdr.depth) / 8);
  if (raw.length !== (rowBytes + 1) * ihdr.height) throw new Error("IDAT size mismatch");
  const gray = new Uint8Array(ihdr.width * ihdr.height);
  let prev = Buffer.alloc(rowBytes);
  for (let y = 0; y < ihdr.height; y++) {
    const f = raw[y * (rowBytes + 1)];
    const row = Buffer.alloc(rowBytes);
    for (let i = 0; i < rowBytes; i++) {
      const x = raw[y * (rowBytes + 1) + 1 + i];
      const a = i ? row[i - 1] : 0, b = prev[i], c = i ? prev[i - 1] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      row[i] = (x + [0, a, b, (a + b) >> 1, paeth][f]) & 255;
    }
    for (let x = 0; x < ihdr.width; x++) {
      gray[y * ihdr.width + x] = ihdr.depth === 8 ? row[x] : (row[x >> 3] >> (7 - (x & 7))) & 1 ? 255 : 0;
    }
    prev = row;
  }
  return { ...ihdr, gray };
}
const darkPixels = (g) => g.reduce((n, v) => n + (v < 128 ? 1 : 0), 0);

// ---------------------------------------------------------------------------
// Server tests through the simulated USPTO
// ---------------------------------------------------------------------------
const allText = [];
const allCalls = [];

async function session(scenario, fn) {
  const log = path.join(os.tmpdir(), `pc-feat-${scenario}-${process.pid}.log`);
  fs.writeFileSync(log, "");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", pathToFileURL(path.join(here, "mock-fetch.mjs")).href, SERVER],
    env: { ...process.env, USPTO_ODP_API_KEY: KEY, MOCK_SCENARIO: scenario, MOCK_LOG: log, PATENT_CONNECTOR_RETRY_SCALE: "0" },
  });
  const client = new Client({ name: "features", version: "1.0.0" });
  await client.connect(transport);
  const call = async (name, args) => {
    const before = fs.readFileSync(log, "utf8").split("\n").filter(Boolean).length;
    const r = await client.callTool({ name, arguments: args });
    const lines = fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const calls = lines.slice(before);
    allCalls.push(...calls);
    const content = r.content || [];
    const text = content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    allText.push(JSON.stringify(content));
    let json = null;
    try { json = JSON.parse(content[0]?.text); } catch {}
    return { isError: !!r.isError, text, json, content, calls, images: content.filter((c) => c.type === "image") };
  };
  try {
    await fn(call, client);
  } finally {
    await client.close();
    fs.rmSync(log, { force: true });
  }
}

await session("feat", async (call, client) => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  check("5 tools listed", names.join(",") === "get_document_text,get_drawings,get_patent,get_patent_documents,search_patents", names.join(","));
  check(
    "every tool is annotated read only",
    tools.every((t) => t.annotations?.title && t.annotations.readOnlyHint === true && t.annotations.destructiveHint === false && t.annotations.idempotentHint === true && t.annotations.openWorldHint === true)
  );
  const gd = tools.find((t) => t.name === "get_drawings");
  check("get_drawings title is 'View patent drawings'", gd?.title === "View patent drawings" && gd?.annotations?.title === "View patent drawings");
  check(
    "per application tools take applicationNumber or patentNumber, neither required",
    ["get_patent", "get_patent_documents", "get_document_text", "get_drawings"].every((n) => {
      const s = tools.find((t) => t.name === n).inputSchema;
      return s.properties.applicationNumber && s.properties.patentNumber && !(s.required || []).length;
    })
  );

  // --- patent number lookup ---------------------------------------------------
  for (const form of ["12399789", "12,399,789", "US 12,399,789 B1", "US12399789", "us 12399789 b2"]) {
    const r = await call("get_patent", { patentNumber: form });
    check(`get_patent patentNumber '${form}' resolves to 18483359`, !r.isError && r.json?.applicationNumber === "18483359" && /resolved to application 18483359/.test(r.json?.patentNumberLookup || ""), r.text);
  }
  let r = await call("get_patent", { patentNumber: "12,399,789" });
  const search = r.calls.find((c) => c.path.endsWith("/applications/search"));
  check("lookup uses the search endpoint by POST", search && search.method === "POST" && search.host === "api.uspto.gov");

  r = await call("get_patent_documents", { patentNumber: "US 12,399,789 B1" });
  check("get_patent_documents accepts patentNumber", !r.isError && r.json?.applicationNumber === "18483359" && r.json.patentNumberLookup, r.text);

  r = await call("get_document_text", { patentNumber: "12399789" });
  check("get_document_text accepts patentNumber", !r.isError && /receiving data/.test(r.json?.text || "") && r.json.patentNumberLookup, r.text);

  r = await call("get_patent", { patentNumber: "D987,654" });
  check("design patent D987,654 resolves (zero padded form tried second)", !r.isError && r.json?.applicationNumber === "29812345", r.text);

  r = await call("get_patent", { patentNumber: "RE49,123" });
  check("reissue not found gives a plain English error naming the prefix rule", r.isError && /No USPTO application with patent number US RE49,123/.test(r.text) && /reissue \(RE\)/.test(r.text), r.text);
  check("reissue lookup tried RE49123 then RE049123", r.calls.filter((c) => c.path.endsWith("/applications/search")).length === 2, r.calls.length);

  r = await call("get_patent", { patentNumber: "11111111" });
  check("unknown patent number: clear not found error", r.isError && /No USPTO application with patent number US 11,111,111 was found/.test(r.text), r.text);

  r = await call("get_patent", { patentNumber: "abc123x" });
  check("malformed patent number rejected locally", r.isError && /does not look like a US patent number/.test(r.text) && r.calls.length === 0, r.text);

  r = await call("get_patent", { patentNumber: "US 2023/0123456 A1" });
  check("publication number gets a pointed error", r.isError && /publication number/.test(r.text) && r.calls.length === 0, r.text);

  r = await call("get_patent", { applicationNumber: "18483359", patentNumber: "12399789" });
  check("both numbers given: error, no request", r.isError && /not both/.test(r.text) && r.calls.length === 0, r.text);

  r = await call("get_patent", {});
  check("neither number given: error, no request", r.isError && /Give either applicationNumber/.test(r.text) && r.calls.length === 0, r.text);

  r = await call("get_drawings", { applicationNumber: "  ", patentNumber: "" });
  check("blank values count as not given", r.isError && /Give either applicationNumber/.test(r.text), r.text);

  r = await call("get_patent", { applicationNumber: "18483359" });
  check("applicationNumber still works and has no lookup note", !r.isError && r.json?.applicationNumber === "18483359" && !r.json.patentNumberLookup, r.text);

  // --- get_drawings -------------------------------------------------------------
  r = await call("get_drawings", { patentNumber: "12,399,789" });
  check("get_drawings default: text then 3 images", !r.isError && r.content[0]?.type === "text" && r.images.length === 3, r.text);
  check("get_drawings default: pages 1 to 3 of 5", JSON.stringify(r.json?.pagesReturned) === "[1,2,3]" && r.json?.totalPages === 5, r.text);
  check("get_drawings picks the most recent DRW document", r.json?.documentId === "LNJFFZ9SXBLUEX4", r.json?.documentId);
  check("get_drawings says which application the patent resolved to", /resolved to application 18483359/.test(r.json?.patentNumberLookup || ""));
  check("get_drawings tells how to get the rest", /pages '4-5'/.test(r.json?.morePages || ""), r.json?.morePages);
  check("get_drawings note says these are USPTO records", /USPTO record/.test(r.json?.note || ""));
  const pdfCall = r.calls.find((c) => c.path.endsWith(".pdf"));
  check("drawings PDF downloaded from api.uspto.gov with the key over HTTPS", pdfCall && pdfCall.host === "api.uspto.gov" && pdfCall.protocol === "https:" && pdfCall.key === KEY);
  for (const [i, img] of r.images.entries()) {
    const png = Buffer.from(img.data, "base64");
    let dec = null;
    let err = "";
    try { dec = decodePng(png); } catch (e) { err = e.message; }
    const dark = dec ? darkPixels(dec.gray) : 0;
    console.log(`  page ${i + 1}: ${dec?.width}x${dec?.height}, ${dec?.depth} bit, ${png.length} bytes PNG, ${dark} dark pixels`);
    check(`page ${i + 1} is a valid PNG (mimeType image/png)`, img.mimeType === "image/png" && dec !== null, err);
    check(`page ${i + 1} is 1236x1600 (Letter aspect, longest side 1600)`, dec?.width === 1236 && dec?.height === 1600, dec && dec.width + "x" + dec.height);
    check(`page ${i + 1} has drawing lines (dark pixels) and is mostly white`, dark > 5000 && dark < dec.gray.length * 0.2, "dark=" + dark);
    check(`page ${i + 1} PNG is under 300 KB`, png.length < 300 * 1024, png.length);
    check(`page ${i + 1} size reported in the summary`, r.json?.images?.[i]?.pngBytes === png.length && r.json.images[i].width === dec?.width);
  }

  r = await call("get_drawings", { applicationNumber: "18483359", pages: "2,4" });
  check("pages '2,4' returns exactly pages 2 and 4", !r.isError && r.images.length === 2 && JSON.stringify(r.json?.pagesReturned) === "[2,4]", r.text);

  r = await call("get_drawings", { applicationNumber: "18483359", pages: "1-5", maxDimension: 600 });
  const dims = r.images.map((i) => decodePng(Buffer.from(i.data, "base64"))).map((d) => d.width + "x" + d.height);
  check("pages '1-5' with maxDimension 600 returns 5 images of 464x600", !r.isError && r.images.length === 5 && dims.every((d) => d === "464x600"), dims.join(","));
  check("all 5 pages shown: no 'more pages' hint", !r.json?.morePages);

  r = await call("get_drawings", { applicationNumber: "18483359", pages: "1", maxDimension: 99999 });
  const big = r.images[0] && decodePng(Buffer.from(r.images[0].data, "base64"));
  check("maxDimension above 2400 is clamped to 2400", big && big.height === 2400 && big.width === 1855, big && big.width + "x" + big.height);

  r = await call("get_drawings", { applicationNumber: "18483359", pages: "1-6" });
  check("more than 5 pages is refused before downloading", r.isError && /at most 5 pages/.test(r.text) && r.calls.length === 0, r.text);

  r = await call("get_drawings", { applicationNumber: "18483359", pages: "7" });
  check("page out of range: plain English error with the page count", r.isError && /Page 7 does not exist/.test(r.text) && /has 5 pages/.test(r.text), r.text);

  r = await call("get_drawings", { applicationNumber: "18483359", pages: "0" });
  check("page 0 is invalid", r.isError && /pages start at 1/.test(r.text), r.text);

  r = await call("get_drawings", { applicationNumber: "18483359", pages: "two" });
  check("pages text is validated", r.isError && /is not valid/.test(r.text), r.text);

  r = await call("get_drawings", { applicationNumber: "18483359", documentId: "OLDDRW0001", pages: "1" });
  check("documentId selects a specific drawings document", !r.isError && r.json?.documentId === "OLDDRW0001" && r.images.length === 1, r.text);

  r = await call("get_drawings", { applicationNumber: "18483359", documentId: "NOPE12345" });
  check("unknown documentId: clear error", r.isError && /was not found in application 18483359/.test(r.text), r.text);

  r = await call("get_drawings", { applicationNumber: "18483359", documentId: "CLMDOC0001" });
  check("document without a PDF: clear error", r.isError && /no PDF download/.test(r.text), r.text);

  r = await call("get_document_text", { applicationNumber: "18483359", documentCode: "DRW" });
  check("get_document_text on drawings points to get_drawings", r.isError && /get_drawings|no DRW document with text/.test(r.text), r.text);
});

await session("feat-nodrw", async (call) => {
  const r = await call("get_drawings", { applicationNumber: "18483359" });
  check("no DRW document: plain English error", r.isError && /has no drawings document \(DRW\)/.test(r.text), r.text);
});

await session("feat-ccitt", async (call) => {
  const r = await call("get_drawings", { applicationNumber: "18483359", pages: "1-2" });
  check("CCITT page: not an error, other pages still shown", !r.isError && r.images.length === 1 && JSON.stringify(r.json?.pagesReturned) === "[1]", r.text);
  check("CCITT page: explains the unsupported format and gives the page count", /Page 2 cannot be shown: .*CCITTFaxDecode/.test(r.text) && r.json?.totalPages === 2, r.text);
  const r2 = await call("get_drawings", { applicationNumber: "18483359", pages: "2" });
  check("only unsupported pages: text only, with a Patent Center link", !r2.isError && r2.images.length === 0 && /patentcenter\.uspto\.gov/.test(r2.text), r2.text);
});

await session("feat-bomb", async (call) => {
  const r = await call("get_drawings", { applicationNumber: "18483359", pages: "1" });
  check("decompression bomb: refused with a plain English size message", !r.isError && r.images.length === 0 && /50 MB safety limit/.test(r.text), r.text);
});

await session("feat-notpdf", async (call) => {
  const r = await call("get_drawings", { applicationNumber: "18483359" });
  check("non PDF download: plain English error", r.isError && /Could not read the drawings PDF.*not a PDF/.test(r.text), r.text);
});

await session("feat-redirect-offsite", async (call) => {
  const r = await call("get_drawings", { applicationNumber: "18483359", pages: "1" });
  const cdn = r.calls.filter((c) => c.host === "cdn.example.net");
  check("PDF redirected off USPTO still downloads", !r.isError && r.images.length === 1, r.text);
  check("key NOT forwarded on the PDF redirect", cdn.length === 1 && cdn[0].key === null, JSON.stringify(cdn));
});

await session("feat-evil-url", async (call) => {
  const r = await call("get_drawings", { applicationNumber: "18483359" });
  check("PDF link to another host is refused", r.isError && /Refusing to contact evil\.example\.com/.test(r.text), r.text);
  check("other host never contacted", !r.calls.some((c) => c.host === "evil.example.com"));
});

check("key never appears in any tool output (text or image data)", allText.length > 30 && !allText.some((t) => t.includes(KEY)));
check("key never sent to a host outside uspto.gov", allCalls.every((c) => c.key === null || (/(^|\.)uspto\.gov$/.test(c.host) && c.protocol === "https:")));
check("no plain HTTP request was ever made", allCalls.every((c) => c.protocol === "https:"));

// ---------------------------------------------------------------------------
// Direct PDF reader and PNG tests
// ---------------------------------------------------------------------------
const sample = new PdfDocument(fs.readFileSync(FIXTURE));
check("sample: 5 pages in /Kids order", sample.pages().length === 5);
const p1 = extractPageImage(sample, 0);
check("sample page 1: 2550x3300 bilevel image, upright", p1.width === 2550 && p1.height === 3300 && p1.bilevel && !p1.orientation.transpose && !p1.orientation.flipX && !p1.orientation.flipY);
check("sample page 1: /Decode [1 0] makes 1 bits black (page is mostly white)", darkPixels(p1.gray) < p1.gray.length * 0.1 && darkPixels(p1.gray) > 10000);

// Cross reference stream with object stream and PNG predictor; 8 bit RGB image
// with a PNG predictor of its own.
{
  const w = 40, h = 30;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    row[0] = 1; // Sub filter
    let prev = [0, 0, 0];
    for (let x = 0; x < w; x++) {
      const v = x < w / 2 ? [255, 0, 0] : [255, 255, 255];
      for (let c = 0; c < 3; c++) { row[1 + x * 3 + c] = (v[c] - prev[c]) & 255; }
      prev = v;
    }
    rows.push(row);
  }
  const pdf = buildImagePdf(
    [{ image: { width: w, height: h, dict: "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /Columns 40 >>", data: zlib.deflateSync(Buffer.concat(rows)) } }],
    { mode: "xrefstream" }
  );
  const doc = new PdfDocument(pdf);
  const img = extractPageImage(doc, 0);
  check("xref stream + object stream: page found", doc.pages().length === 1 && doc.xref.get(1)?.type === 2);
  check("RGB with PNG predictor: red becomes gray 76, white stays 255", img.gray[0] === 76 && img.gray[w - 1] === 255 && img.gray[(h - 1) * w + 5] === 76, [img.gray[0], img.gray[w - 1]]);
}

// Rotated page and rotated placement.
{
  const pdf = buildImagePdf([
    { image: bilevelScan(200, 100), rotate: 90 },
    { image: bilevelScan(200, 100), content: "q 0 100 -200 0 200 0 cm /Im0 Do Q" },
  ]);
  const doc = new PdfDocument(pdf);
  const a = extractPageImage(doc, 0);
  const oa = orient(a, a.orientation);
  check("/Rotate 90 page turns the image (200x100 becomes 100x200)", oa.width === 100 && oa.height === 200, oa.width + "x" + oa.height);
  const b = extractPageImage(doc, 1);
  const ob = orient(b, b.orientation);
  check("placement matrix with a quarter turn is honored", b.orientation.transpose && ob.width === 100 && ob.height === 200);
}

// ImageMask, Indexed, damaged xref, garbage, loops.
{
  const mask = buildImagePdf([{ image: { width: 8, height: 1, dict: "/ImageMask true /Decode [1 0]", data: Buffer.from([0xf0]) } }]);
  const m = extractPageImage(new PdfDocument(mask), 0);
  check("ImageMask /Decode [1 0]: 1 bits paint black", m.gray[0] === 0 && m.gray[7] === 255, Array.from(m.gray));
  const idx = buildImagePdf([{ image: { width: 2, height: 1, dict: "/ColorSpace [/Indexed /DeviceRGB 1 <000000FFFFFF>] /BitsPerComponent 8", data: Buffer.from([1, 0]) } }]);
  const ix = extractPageImage(new PdfDocument(idx), 0);
  check("Indexed color space maps through the palette", ix.gray[0] === 255 && ix.gray[1] === 0, Array.from(ix.gray));
  const broken = buildImagePdf([{ image: bilevelScan(64, 64) }], { badStartxref: true });
  const bd = new PdfDocument(broken);
  check("wrong startxref offset: file is rebuilt by scanning", bd.pages().length === 1 && extractPageImage(bd, 0).width === 64);
  let msg = "";
  try { new PdfDocument(Buffer.from("hello")); } catch (e) { msg = e instanceof PdfError ? e.message : "wrong type"; }
  check("garbage input: PdfError 'not a PDF'", /not a PDF/.test(msg), msg);
  const loop = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [2 0 R 3 0 R] >> endobj\n3 0 obj << /Type /Pages /Kids [2 0 R 3 0 R] >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
  const ld = new PdfDocument(loop);
  check("page tree loop: no hang, zero pages", ld.pages().length === 0);
  const refLoop = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj 3 0 R endobj\n3 0 obj 2 0 R endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
  let refMsg = "";
  try { new PdfDocument(refLoop).pages(); } catch (e) { refMsg = e.message; }
  check("reference loop: plain error, no hang", /loop/.test(refMsg), refMsg);
  const ccitt = buildImagePdf([{ image: { width: 8, height: 8, dict: "/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /CCITTFaxDecode", data: Buffer.alloc(8) } }]);
  let unsupported = null;
  try { extractPageImage(new PdfDocument(ccitt), 0); } catch (e) { unsupported = e; }
  check("CCITTFaxDecode raises UnsupportedImageError", unsupported instanceof UnsupportedImageError && /CCITTFaxDecode/.test(unsupported.message));
  check("decompressed size limit is 50 MB per image", LIMITS.maxImageBytes === 50 * 1024 * 1024);
}

// Other stream filters, decoded directly.
{
  const decode = (filter, data, parms) => {
    const dict = Object.assign(Object.create(null), { Filter: filter, Length: data.length });
    if (parms) dict.DecodeParms = parms;
    const buf = Buffer.concat([data, Buffer.from("\nendstream")]);
    return sample.decodeStream(new Stream(dict, 0, buf), 1 << 20).toString("latin1");
  };
  // The LZW example from the PDF specification (section 7.4.4).
  check("LZWDecode: PDF specification example", decode(new Name("LZWDecode"), Buffer.from("800B6050220C0C8501", "hex")) === "-----A---B");
  check("ASCIIHexDecode then FlateDecode chain", decode([new Name("AHx"), new Name("Fl")], Buffer.from(zlib.deflateSync(Buffer.from("drawing")).toString("hex") + ">")) === "drawing");
  check("ASCII85Decode", decode(new Name("ASCII85Decode"), Buffer.from("87cURD]i,\"Ebo80~>")) === "Hello World!");
  check("RunLengthDecode", decode(new Name("RunLengthDecode"), Buffer.from([2, 0x61, 0x62, 0x63, 254, 0x7a, 128])) === "abczzz");
}

// PNG encoder round trip and downscale behaviour.
{
  const g = new Uint8Array(300 * 200).fill(255);
  for (let y = 0; y < 200; y++) g[y * 300 + 150] = 0; // one pixel wide vertical line
  const small = downscale({ width: 300, height: 200, gray: g }, 100, { bilevel: true });
  const col = Array.from({ length: small.height }, (_, y) => Math.min(...small.gray.subarray(y * small.width, (y + 1) * small.width)));
  check("area averaging keeps a 1 pixel line visible at one third scale", small.width === 100 && small.height === 67 && Math.max(...col) < 200, Math.max(...col));
  const enc = decodePng(encodePngGray(small));
  check("8 bit PNG round trip is exact", enc.depth === 8 && Buffer.from(enc.gray).equals(Buffer.from(small.gray)));
  const bw = { width: 13, height: 3, gray: Uint8Array.from({ length: 39 }, (_, i) => (i % 3 ? 255 : 0)) };
  const enc1 = decodePng(encodePngGray(bw));
  check("pure black and white is stored at 1 bit and round trips", enc1.depth === 1 && Buffer.from(enc1.gray).equals(Buffer.from(bw.gray)));
  const same = downscale({ width: 10, height: 10, gray: new Uint8Array(100) }, 1600);
  check("never enlarges", same.width === 10 && same.height === 10);
}

console.log(failures ? `\n${failures} FAILED, ${passes} passed` : `\nALL PASSED (${passes} checks)`);
process.exit(failures ? 1 : 0);
