// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
// Test only: replaces global fetch with a simulated USPTO so security
// behaviour and retry handling can be checked offline. Loaded with `node --import`.
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildImagePdf, bilevelScan } from "./pdf-builder.mjs";

const scenario = process.env.MOCK_SCENARIO;
const log = process.env.MOCK_LOG;
const XML = '<?xml version="1.0"?><uspat:ClaimsDocument xmlns:uspat="u"><uspat:Claims><uscom:P xmlns:uscom="c">1. A method comprising receiving data.</uscom:P></uspat:Claims></uspat:ClaimsDocument>';

function docs(downloadUrl) {
  return { count: 1, documentBag: [{
    applicationNumberText: "16123456", documentIdentifier: "DOC1", documentCode: "CLM",
    documentCodeDescriptionText: "Claims", officialDate: "2026-01-01",
    downloadOptionBag: [{ mimeTypeIdentifier: "XML", downloadUrl }],
  }] };
}

let calls = 0;

// ---------------------------------------------------------------------------
// "feat-*" scenarios (test/features.mjs): patent number lookup and drawings.
// ---------------------------------------------------------------------------
const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "drw-18483359.pdf");
const PATENTS = {
  // utility patent: stored as plain digits
  "12399789": { app: "18483359", stored: "12399789", title: "Isolated storage system access" },
  // design patent: this mock stores it zero padded, so the lookup must try both forms
  "D0987654": { app: "29812345", stored: "D0987654", title: "Ornamental lamp" },
};
const DRW_URL = "https://api.uspto.gov/api/v1/download/applications/18483359/LNJFFZ9SXBLUEX4.pdf";

function featDocuments() {
  const bag = [
    { documentIdentifier: "OLDDRW0001", documentCode: "DRW", documentCodeDescriptionText: "Drawings only black and white line drawings", officialDate: "2023-10-09T00:00:00.000-0400",
      downloadOptionBag: [{ mimeTypeIdentifier: "PDF", downloadUrl: "https://api.uspto.gov/api/v1/download/applications/18483359/OLDDRW0001.pdf", pageTotalQuantity: 5 }] },
    { documentIdentifier: "LNJFFZ9SXBLUEX4", documentCode: "DRW", documentCodeDescriptionText: "Drawings only black and white line drawings", officialDate: "2024-01-15T00:00:00.000-0500",
      downloadOptionBag: [{ mimeTypeIdentifier: "PDF", downloadUrl: scenario === "feat-evil-url" ? "https://evil.example.com/drw.pdf" : DRW_URL, pageTotalQuantity: 5 }] },
    { documentIdentifier: "CLMDOC0001", documentCode: "CLM", documentCodeDescriptionText: "Claims", officialDate: "2023-10-09T00:00:00.000-0400",
      downloadOptionBag: [{ mimeTypeIdentifier: "XML", downloadUrl: "https://api.uspto.gov/api/v1/download/applications/18483359/CLMDOC0001/xmlarchive" }] },
  ];
  return { count: bag.length, documentBag: scenario === "feat-nodrw" ? bag.filter((d) => d.documentCode !== "DRW") : bag };
}

function featPdf() {
  if (scenario === "feat-ccitt") {
    // Page 1 is a normal Flate scan; page 2 claims CCITT fax compression.
    return buildImagePdf([
      { image: bilevelScan(850, 1100) },
      { image: { width: 850, height: 1100, dict: "/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /CCITTFaxDecode /DecodeParms << /K -1 /Columns 850 >>", data: Buffer.alloc(64, 0xaa) } },
    ]);
  }
  if (scenario === "feat-bomb") {
    // Declares a small 1 bit image but inflates to 60 MB.
    const bomb = zlib.deflateSync(Buffer.alloc(60 * 1024 * 1024));
    return buildImagePdf([{ image: { width: 2550, height: 3300, dict: "/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /FlateDecode", data: bomb } }]);
  }
  if (scenario === "feat-notpdf") return Buffer.from("<html><body>Service unavailable</body></html>");
  return fs.readFileSync(FIXTURE);
}

function featFetch(url, init, json) {
  if (url.host === "cdn.example.net" || url.host === "evil.example.com") return new Response(featPdf(), { status: 200 });
  if (url.host !== "api.uspto.gov") return new Response("unexpected", { status: 500 });
  if (url.pathname === "/api/v1/patent/applications/search") {
    const q = JSON.parse(init.body || "{}").q || "";
    const m = q.match(/^applicationMetaData\.patentNumber:([A-Z0-9]+)$/);
    const hit = m && PATENTS[m[1]];
    if (!hit) return new Response(JSON.stringify({ code: 404, error: "No matching records found" }), { status: 404 });
    return json({ count: 1, patentFileWrapperDataBag: [{ applicationNumberText: hit.app, applicationMetaData: { patentNumber: hit.stored, inventionTitle: hit.title } }] });
  }
  let m = url.pathname.match(/^\/api\/v1\/patent\/applications\/(\d+)$/);
  if (m) {
    const hit = Object.values(PATENTS).find((p) => p.app === m[1]);
    if (!hit && m[1] !== "16123456") return new Response("not found", { status: 404 });
    return json({ count: 1, patentFileWrapperDataBag: [{ applicationNumberText: m[1], applicationMetaData: { inventionTitle: hit ? hit.title : "Plain widget", patentNumber: hit?.stored } }] });
  }
  m = url.pathname.match(/^\/api\/v1\/patent\/applications\/(\d+)\/documents$/);
  if (m) return m[1] === "18483359" ? json(featDocuments()) : json({ count: 0, documentBag: [] });
  if (/\/download\/applications\/18483359\/\w+\.pdf$/.test(url.pathname)) {
    if (scenario === "feat-redirect-offsite") return new Response(null, { status: 302, headers: { location: "https://cdn.example.net/drw.pdf" } });
    return new Response(featPdf(), { status: 200, headers: { "content-type": "application/pdf" } });
  }
  if (url.pathname.endsWith("/xmlarchive")) return new Response(XML, { status: 200 });
  return new Response("unexpected", { status: 500 });
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const headers = init.headers || {};
  fs.appendFileSync(log, JSON.stringify({ host: url.host, path: url.pathname, protocol: url.protocol, method: init.method || "GET", key: headers["x-api-key"] || null, t: Date.now() }) + "\n");
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
  calls++;
  if (scenario && scenario.startsWith("feat")) return featFetch(url, init, json);
  if (scenario && scenario.startsWith("retry-") && /\/patent\/applications\/\d+$/.test(url.pathname)) {
    const fail = (status, extra = {}) => new Response("busy", { status, headers: extra });
    const ok = () => json({ count: 1, patentFileWrapperDataBag: [{ applicationNumberText: "16123456", applicationMetaData: { inventionTitle: "Retry test widget" } }] });
    if (scenario === "retry-429-once") return calls === 1 ? fail(429) : ok();
    if (scenario === "retry-429-always") return fail(429);
    if (scenario === "retry-503-twice") return calls <= 2 ? fail(503) : ok();
    if (scenario === "retry-after-capped") return calls === 1 ? fail(429, { "retry-after": "30" }) : ok();
    if (scenario === "retry-400") return fail(400);
    if (scenario === "retry-404") return fail(404);
  }
  if (url.pathname.endsWith("/documents")) {
    if (scenario === "evil-downloadurl") return json(docs("https://evil.example.com/steal"));
    return json(docs("https://api.uspto.gov/api/v1/download/applications/16123456/DOC1/xmlarchive"));
  }
  if (url.host === "api.uspto.gov" && url.pathname.includes("/download/")) {
    if (scenario === "redirect-offsite") return new Response(null, { status: 302, headers: { location: "https://cdn.example.net/file.xml" } });
    if (scenario === "redirect-http") return new Response(null, { status: 302, headers: { location: "http://api.uspto.gov/plain" } });
    if (scenario === "huge") return new Response("x", { status: 200, headers: { "content-length": String(30 * 1024 * 1024) } });
    return new Response(XML, { status: 200 });
  }
  if (url.host === "cdn.example.net") return new Response(XML, { status: 200 });
  return new Response("unexpected", { status: 500 });
};
