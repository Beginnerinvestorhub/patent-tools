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

// MOCK_RETRY_SCALE scales the server's retry waits (its only setTimeout use;
// the request timeout uses AbortSignal.timeout). 0 makes them instant and
// 0.01 turns 10 s into 100 ms. This lives here, not in index.js, so the
// shipped server reads nothing but USPTO_ODP_API_KEY from its environment.
const retryScale = Number(process.env.MOCK_RETRY_SCALE ?? "0");
if (Number.isFinite(retryScale) && retryScale >= 0 && retryScale < 1) {
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...rest) => realSetTimeout(fn, (Number(ms) || 0) * retryScale, ...rest);
}
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
// A real USPTO drawings PDF whose pages are CCITT Group 4 fax images (US 10,706,165).
const FAX_FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "drw-15015911-ccitt.pdf");
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
  if (scenario === "feat-unsupported") {
    // Page 1 is a normal Flate scan; page 2 claims JBIG2 compression.
    return buildImagePdf([
      { image: bilevelScan(850, 1100) },
      { image: { width: 850, height: 1100, dict: "/ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /JBIG2Decode", data: Buffer.alloc(64, 0xaa) } },
    ]);
  }
  if (scenario === "feat-fax") return fs.readFileSync(FAX_FIXTURE);
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

// ---------------------------------------------------------------------------
// "res" scenario (test/research.mjs): office actions and petition decisions.
// ---------------------------------------------------------------------------
const OA = [
  { officeActionRecordIdentifier: "7e0f21f01fe3bf91fc98254d4d211a51", applicationNumberText: "16123456", inventionTitle: "LEARNING ASSISTANCE DEVICE", patentNumber: "10902286",
    documentCode: "NOA", documentCodeDescriptionText: "NOA", submissionDate: "2020-09-23", groupArtUnitNumber: 2641, officeActionText: "EXAMINER'S AMENDMENT &amp; reasons for allowance" },
  { officeActionRecordIdentifier: "59a95b2cc615208718119d84c780952b", applicationNumberText: "16123456", inventionTitle: "LEARNING ASSISTANCE DEVICE",
    documentCode: "CTNF", documentCodeDescriptionText: "Non-Final Rejections", submissionDate: "2020-03-27", groupArtUnitNumber: 2641, rejectionTypeBag: ["102", "DoublePatent", "Other"],
    officeActionText: "Claims 1-10 are rejected under 35 U.S.C. 102" },
];
const HIT = { officeActionRecordIdentifier: "543aba1e02df4ff421308d4ab2226034", applicationNumberText: "18322045", documentCode: "CTNF", documentCodeDescriptionText: "Non-Final Rejections",
  submissionDate: "2024-05-01", groupArtUnitNumber: 2836, rejectionTypeBag: ["101", "102", "103"],
  officeActionText: "acts as a <b><span style='background-color: yellow;'>wireless</span></b> <b><span style='background-color: yellow;'>charging</span></b> pad (Graham &#182; [0025]) which acts as a <b><span sty ..." };
const OA_TEXT = "DETAILED ACTION\r\nClaim Rejections - 35 USC 103   \r\n\r\n\r\n\r\nClaims 1-10 are rejected under 35 U.S.C. 103 as being unpatentable over Tuttle in view of Graham. " + "Further reasoning. ".repeat(400);
const PETITION = {
  petitionDecisionRecordIdentifier: "db2fa543-3e29-5c1a-8606-390f032bb1ac", applicationNumberText: "17711617", inventionTitle: "GENERATING MINORITY-CLASS EXAMPLES",
  firstApplicantName: "NEC Laboratories America, Inc.", petitionMailDate: "2026-10-13", decisionDate: "2026-10-13",
  decisionPetitionTypeCodeDescriptionText: "REVIVE AN APPLICATION ABANDONED - UNINTENTIONALLY DELAYED REPLY (37 CFR 1.137(A))",
  decidedPetitionTypeCodeDescriptionText: "GRANTED", finalDecidingOfficeName: "OFFICE OF PETITIONS", ruleBag: ["37 CFR 1.137(a)"], technologyCenter: "1600",
  ocrSearchText: "petition under 37 CFR 1.137(a) to <b><span style='background-color: yellow;'>revive</span></b> the application &lt;script&gt;x <<b>i>y",
  allSearchableFields: "very long text that should never be shown",
  documentBag: [{ documentCode: "PET.DEC.AUTO", documentIdentifier: "MV71JOQ8237X196", documentCodeDescriptionText: "ePetition Grant Letter", officialDate: "2026-10-13T18:50:42",
    downloadOptionBag: [{ mimeTypeIdentifier: "PDF", downloadUrl: "https://api.uspto.gov/api/v1/download/applications/17711617/MV71JOQ8237X196/files/grantLetter.pdf", pageTotalQuantity: 1 }] }],
};
const notFound = () => new Response(JSON.stringify({ code: 404, error: "Not Found", errorDetails: "No matching records found" }), { status: 404 });

function researchFetch(url, init, json) {
  if (url.host !== "api.uspto.gov") return new Response("unexpected", { status: 500 });
  const body = init.body ? JSON.parse(init.body) : {};
  const filter = (name) => (body.filters || []).find((f) => f.name === name)?.value?.[0];
  if (url.pathname === "/api/v1/patent/applications/search") {
    if (/patentNumber:10902286$/.test(body.q || "")) return json({ count: 1, patentFileWrapperDataBag: [{ applicationNumberText: "16123456", applicationMetaData: { patentNumber: "10902286" } }] });
    return notFound();
  }
  if (url.pathname === "/api/v1/patent/office-action/search") {
    if (/nomatch/.test(body.q || "")) return notFound();
    const app = filter("applicationNumberText");
    if (app) {
      let bag = app === "16123456" ? OA.slice() : [];
      const code = filter("documentCode");
      if (code) bag = bag.filter((o) => o.documentCode === code);
      if (!bag.length) return notFound();
      return json({ count: bag.length, officeActionDataBag: bag });
    }
    return json({ count: 9134, officeActionDataBag: [HIT], facets: { rejectionTypeBag: [{ value: "103", count: 7744 }, { value: "DoublePatent", count: 1025 }], documentCode: [{ value: "CTNF", count: 9134 }] } });
  }
  let m = url.pathname.match(/^\/api\/v1\/patent\/office-action\/([^/]+)\/download\/officeActionText$/);
  if (m) return new Response(OA_TEXT, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
  m = url.pathname.match(/^\/api\/v1\/patent\/office-action\/([^/]+)$/);
  if (m) {
    const rec = [...OA, HIT].find((o) => o.officeActionRecordIdentifier === decodeURIComponent(m[1]));
    return rec ? json({ count: 1, officeActionDataBag: [rec] }) : notFound();
  }
  if (url.pathname === "/api/v1/petition/decisions/search") {
    if (/nomatch/.test(body.q || "")) return notFound();
    return json({ count: 1, petitionDecisionDataBag: [PETITION], facets: { decidedPetitionTypeCodeDescriptionText: [{ value: "GRANTED", count: 1 }] } });
  }
  return new Response("unexpected", { status: 500 });
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const headers = init.headers || {};
  fs.appendFileSync(log, JSON.stringify({ host: url.host, path: url.pathname, protocol: url.protocol, method: init.method || "GET", key: headers["x-api-key"] || null, body: typeof init.body === "string" ? init.body : null, t: Date.now() }) + "\n");
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
  calls++;
  if (scenario && scenario.startsWith("feat")) return featFetch(url, init, json);
  if (scenario === "res") return researchFetch(url, init, json);
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
