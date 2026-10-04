// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
// Test only: replaces global fetch with a simulated USPTO so security
// behaviour can be checked offline. Loaded with `node --import`.
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

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const headers = init.headers || {};
  fs.appendFileSync(log, JSON.stringify({ host: url.host, path: url.pathname, protocol: url.protocol, key: headers["x-api-key"] || null }) + "\n");
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
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
