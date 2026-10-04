// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
// Live smoke test. Requires USPTO_ODP_API_KEY in the environment.
// Run: node test/smoke.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(here, "..", "index.js")],
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
  return { isError: !!r.isError, text, json };
};

const { tools } = await client.listTools();
check("4 tools listed", tools.length === 4, tools.map((t) => t.name).join(", "));
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

r = await call("get_patent", { applicationNumber: "18/483,359" });
check("get_patent summary", !r.isError && r.json.patentNumber && r.json.inventors?.length > 0, r.json?.title);

r = await call("get_patent", { applicationNumber: "abc" });
check("bad app number rejected locally", r.isError && /not a valid/.test(r.text));

r = await call("get_patent_documents", { applicationNumber: "19809499" });
check("key documents", !r.isError && r.json.shown < r.json.totalDocuments && r.json.documents.some((d) => d.code === "CLM"), r.json && r.json.shown + "/" + r.json.totalDocuments);

r = await call("get_document_text", { applicationNumber: "19809499", documentCode: "CLM", maxChars: 2000 });
check("claims text", !r.isError && r.json.text.length > 500 && !/<uscom:/.test(r.json.text), "chars=" + r.json?.totalChars);
if (r.json?.text) console.log("  sample: " + r.json.text.slice(0, 300).replace(/\n/g, " | "));

check("no image metadata in text", r.json && !/\.svg|Black and white/i.test(r.json.text));

r = await call("get_document_text", { applicationNumber: "18483359", documentCode: "CLM", maxChars: 1500 });
check("claims text, granted patent", !r.isError && /claim/i.test(r.json.text), "chars=" + r.json?.totalChars);
if (r.json?.text) console.log("  sample: " + r.json.text.slice(0, 300).replace(/\n/g, " | "));

r = await call("get_document_text", { applicationNumber: "18483359", documentCode: "ABST" });
check("abstract text", !r.isError && r.json.text.length > 100, "chars=" + r.json?.totalChars);

r = await call("get_document_text", { applicationNumber: "19809499", documentCode: "DRW" });
check("drawings explain no text", r.isError && /no DRW document with text|scanned/.test(r.text));

await client.close();
console.log(failures ? "\n" + failures + " FAILED" : "\nALL PASSED");
process.exit(failures ? 1 : 0);
