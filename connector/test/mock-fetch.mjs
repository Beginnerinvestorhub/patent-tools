// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
// Test only: replaces global fetch with a simulated USPTO so security
// behaviour and retry handling can be checked offline. Loaded with `node --import`.
import fs from "node:fs";

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

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const headers = init.headers || {};
  fs.appendFileSync(log, JSON.stringify({ host: url.host, path: url.pathname, protocol: url.protocol, key: headers["x-api-key"] || null, t: Date.now() }) + "\n");
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
  calls++;
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
