// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
// Offline tests for the office action and petition decision tools, through
// the server against a simulated USPTO (test/mock-fetch.mjs, scenario "res").
// Run: node test/research.mjs   (no API key or network needed)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(here, "..", "index.js");
const KEY = "TEST_KEY_DO_NOT_LEAK_9c1e";
let failures = 0;
let passes = 0;
const check = (label, cond, extra = "") => {
  console.log((cond ? "PASS " : "FAIL ") + label + (!cond && extra ? "  " + String(extra).slice(0, 400) : ""));
  if (cond) passes++;
  else failures++;
};

const log = path.join(os.tmpdir(), `pc-res-${process.pid}.log`);
fs.writeFileSync(log, "");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["--import", pathToFileURL(path.join(here, "mock-fetch.mjs")).href, SERVER],
  env: { ...process.env, USPTO_ODP_API_KEY: KEY, MOCK_SCENARIO: "res", MOCK_LOG: log, MOCK_RETRY_SCALE: "0" },
});
const client = new Client({ name: "research", version: "1.0.0" });
await client.connect(transport);
const allText = [];
const allCalls = [];
const call = async (name, args) => {
  const before = fs.readFileSync(log, "utf8").split("\n").filter(Boolean).length;
  const r = await client.callTool({ name, arguments: args });
  const calls = fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).slice(before);
  allCalls.push(...calls);
  const text = (r.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  allText.push(text);
  let json = null;
  try { json = JSON.parse(text); } catch {}
  const bodies = calls.map((c) => { try { return JSON.parse(c.body); } catch { return null; } });
  return { isError: !!r.isError, text, json, calls, bodies };
};

try {
  // --- tool listing ------------------------------------------------------------
  const { tools } = await client.listTools();
  for (const n of ["search_office_actions", "get_office_action", "search_petition_decisions"]) {
    const t = tools.find((x) => x.name === n);
    check(n + " is listed, read only, titled, with no required inputs",
      t && t.title && t.annotations?.title === t.title && t.annotations.readOnlyHint === true && t.annotations.destructiveHint === false && !(t.inputSchema.required || []).length);
  }

  // --- search_office_actions ---------------------------------------------------
  let r = await call("search_office_actions", {});
  check("search_office_actions with nothing to search is refused locally", r.isError && /Give a query/.test(r.text) && r.calls.length === 0, r.text);

  r = await call("search_office_actions", { query: "wireless charging", rejectionType: "103", limit: 5 });
  const oaBody = r.bodies.find((b) => b && b.facets);
  check("office action search POSTs to the office action endpoint", r.calls.some((c) => c.method === "POST" && c.path === "/api/v1/patent/office-action/search" && c.host === "api.uspto.gov"));
  check("request has the query, 103 filter, facets and a field list without allSearchableFields",
    oaBody && oaBody.q === "(wireless AND charging)" && oaBody.filters?.some((f) => f.name === "rejectionTypeBag" && f.value[0] === "103") &&
      oaBody.facets.includes("rejectionTypeBag") && oaBody.fields.includes("officeActionText") && !oaBody.fields.includes("allSearchableFields") && oaBody.pagination.limit === 5 && !oaBody.sort,
    JSON.stringify(oaBody));
  const hit = r.json?.results?.[0];
  check("result excerpt has the highlight markup removed, a cut off tag dropped and entities decoded",
    hit && hit.excerpt === "acts as a wireless charging pad (Graham ¶ [0025]) which acts as a ..." && !/</.test(hit.excerpt), hit?.excerpt);
  check("result rejection types are labeled in plain English",
    hit && hit.rejectionTypes.join("|") === "35 U.S.C. 101 (eligibility or utility)|35 U.S.C. 102 (anticipation, not new)|35 U.S.C. 103 (obviousness)" && hit.artUnit === "2836" && hit.officeActionId === "543aba1e02df4ff421308d4ab2226034", JSON.stringify(hit));
  check("rejection type counts across all matches are labeled",
    r.json?.rejectionTypeCounts?.["35 U.S.C. 103 (obviousness)"] === 7744 && r.json.rejectionTypeCounts["Double patenting"] === 1025 && r.json.documentTypeCounts?.CTNF === 9134 && r.json.nextOffset === 1, JSON.stringify(r.json));

  r = await call("search_office_actions", { query: "x", rejectionType: "104" });
  check("unknown rejectionType is refused locally", r.isError && /rejectionType must be one of/.test(r.text) && r.calls.length === 0, r.text);
  r = await call("search_office_actions", { artUnit: "26x1" });
  check("bad artUnit is refused locally", r.isError && /artUnit/.test(r.text) && r.calls.length === 0, r.text);
  r = await call("search_office_actions", { query: "x", dateFrom: "2024-13-40" });
  check("bad date is refused locally", r.isError && /YYYY-MM-DD/.test(r.text) && r.calls.length === 0, r.text);
  r = await call("search_office_actions", { query: "x", documentCode: "CT NF;" });
  check("bad documentCode is refused locally", r.isError && /document code/.test(r.text) && r.calls.length === 0, r.text);

  r = await call("search_office_actions", { patentNumber: "US 10,902,286 B2", dateFrom: "2020-01-01", artUnit: "2641" });
  const byPatent = r.bodies.find((b) => b && b.facets);
  check("by patent number: looked up, filtered by application, art unit and date, newest first",
    !r.isError && /resolved to application 16123456/.test(r.json?.patentNumberLookup || "") && byPatent && !byPatent.q &&
      byPatent.filters.some((f) => f.name === "applicationNumberText" && f.value[0] === "16123456") &&
      byPatent.filters.some((f) => f.name === "groupArtUnitNumber" && f.value[0] === "2641") &&
      byPatent.rangeFilters?.[0]?.field === "submissionDate" && byPatent.rangeFilters[0].valueFrom === "2020-01-01" &&
      byPatent.sort?.[0]?.field === "submissionDate" && byPatent.sort[0].order === "desc" &&
      r.json.results.length === 2 && r.json.filters?.applicationNumber === "16123456",
    r.text.slice(0, 400));

  r = await call("search_office_actions", { query: "nomatch here" });
  check("no matching office actions is an empty result, not an error", !r.isError && r.json.totalMatches === 0 && r.json.results.length === 0 && /No office actions matched/.test(r.json.note), r.text);

  // --- get_office_action -------------------------------------------------------
  r = await call("get_office_action", {});
  check("get_office_action with nothing is refused locally", r.isError && /Give an officeActionId/.test(r.text) && r.calls.length === 0, r.text);
  r = await call("get_office_action", { officeActionId: "abc", applicationNumber: "16123456" });
  check("get_office_action with both id and application is refused", r.isError && /not both/.test(r.text) && r.calls.length === 0, r.text);
  r = await call("get_office_action", { officeActionId: "../../patent/applications" });
  check("path like officeActionId is refused before any request", r.isError && /does not look valid/.test(r.text) && r.calls.length === 0, r.text);

  r = await call("get_office_action", { officeActionId: "543aba1e02df4ff421308d4ab2226034", maxChars: 1000 });
  check("get_office_action by id reads metadata then the text download",
    !r.isError && r.calls.length === 2 && r.calls[0].path === "/api/v1/patent/office-action/543aba1e02df4ff421308d4ab2226034" &&
      r.calls[1].path === "/api/v1/patent/office-action/543aba1e02df4ff421308d4ab2226034/download/officeActionText", JSON.stringify(r.calls.map((c) => c.path)));
  check("office action text is cleaned (no CR, no trailing spaces, no runs of blank lines) and paged",
    r.json && r.json.text.startsWith("DETAILED ACTION\nClaim Rejections - 35 USC 103\n\nClaims 1-10") && !/\r/.test(r.json.text) &&
      r.json.returnedChars === 1000 && r.json.nextStartChar === 1000 && r.json.totalChars > 7000 && !r.json.excerpt && r.json.rejectionTypes?.length === 3,
    r.text.slice(0, 300));
  const total = r.json?.totalChars;
  r = await call("get_office_action", { officeActionId: "543aba1e02df4ff421308d4ab2226034", startChar: total - 200 });
  check("reading the last page has no nextStartChar", !r.isError && r.json.returnedChars === 200 && r.json.nextStartChar === undefined, r.text.slice(0, 200));

  r = await call("get_office_action", { officeActionId: "ffffffffffffffffffffffffffffffff" });
  check("unknown office action id: plain not found", r.isError && /No office action ffff/.test(r.text), r.text);

  r = await call("get_office_action", { applicationNumber: "16/123,456" });
  const latest = r.bodies.find((b) => b && b.filters);
  check("get_office_action by application picks the newest action and lists the rest",
    !r.isError && r.json.officeActionId === "7e0f21f01fe3bf91fc98254d4d211a51" && r.json.documentCode === "NOA" &&
      r.json.otherOfficeActions?.length === 1 && r.json.otherOfficeActions[0].documentCode === "CTNF" &&
      latest.sort?.[0]?.order === "desc" && !latest.fields.includes("officeActionText"),
    r.text.slice(0, 400));
  r = await call("get_office_action", { patentNumber: "10902286", documentCode: "ctnf" });
  check("get_office_action by patent number and documentCode picks the CTNF",
    !r.isError && r.json.documentCode === "CTNF" && /resolved to application 16123456/.test(r.json.patentNumberLookup || "") && !r.json.otherOfficeActions, r.text.slice(0, 300));
  r = await call("get_office_action", { applicationNumber: "16123456", documentCode: "CTFR" });
  check("no office action of that type: plain explanation", r.isError && /No CTFR office actions were found for application 16123456/.test(r.text), r.text);

  // --- search_petition_decisions -----------------------------------------------
  r = await call("search_petition_decisions", { outcome: "granted" });
  check("petition search needs a query or application", r.isError && /Give a query/.test(r.text) && r.calls.length === 0, r.text);
  r = await call("search_petition_decisions", { query: "x", outcome: "granted; drop" });
  check("odd outcome value is refused locally", r.isError && /outcome must be/.test(r.text) && r.calls.length === 0, r.text);

  r = await call("search_petition_decisions", { query: "revive", outcome: "granted", decidedFrom: "2026-01-01", sort: "newest" });
  const petBody = r.bodies.find((b) => b && b.facets);
  check("petition search POSTs the query, uppercased outcome filter, date range and sort",
    r.calls.some((c) => c.method === "POST" && c.path === "/api/v1/petition/decisions/search") && petBody && petBody.q === "revive" &&
      petBody.filters?.[0]?.name === "decidedPetitionTypeCodeDescriptionText" && petBody.filters[0].value[0] === "GRANTED" &&
      petBody.rangeFilters?.[0]?.field === "decisionDate" && petBody.sort?.[0]?.field === "decisionDate" && !petBody.fields.includes("allSearchableFields"),
    JSON.stringify(petBody));
  const pet = r.json?.results?.[0];
  check("petition result is summarized with outcome, rules, a markup free excerpt (even for encoded or nested tags) and decision documents",
    pet && pet.outcome === "GRANTED" && pet.rules[0] === "37 CFR 1.137(a)" && pet.excerpt === "petition under 37 CFR 1.137(a) to revive the application scriptx iy" && !/[<>]/.test(pet.excerpt) &&
      pet.decisionDocuments?.[0]?.documentId === "MV71JOQ8237X196" && pet.decisionDocuments[0].pages === 1 &&
      pet.patentCenterUrl === "https://patentcenter.uspto.gov/applications/17711617" && r.json.outcomeCounts?.GRANTED === 1, JSON.stringify(pet));
  check("petition result leaves out the raw search blob and key protected download links",
    !/very long text that should never be shown/.test(r.text) && !/api\.uspto\.gov\/api\/v1\/download/.test(r.text), r.text.slice(0, 300));

  r = await call("search_petition_decisions", { patentNumber: "10,902,286" });
  const petByApp = r.bodies.find((b) => b && b.facets);
  check("petition search by patent number filters by its application, newest first",
    !r.isError && petByApp && !petByApp.q && petByApp.filters[0].name === "applicationNumberText" && petByApp.filters[0].value[0] === "16123456" && petByApp.sort?.[0]?.order === "desc",
    JSON.stringify(petByApp));
  r = await call("search_petition_decisions", { query: "nomatch" });
  check("no matching petitions is an empty result, not an error", !r.isError && r.json.totalMatches === 0, r.text);

  // --- key handling ------------------------------------------------------------
  check("every request went to api.uspto.gov over HTTPS with the key", allCalls.length > 0 && allCalls.every((c) => c.host === "api.uspto.gov" && c.protocol === "https:" && c.key === KEY));
  check("the API key never appears in any tool output", allText.every((t) => !t.includes(KEY)));
} finally {
  await client.close();
  fs.rmSync(log, { force: true });
}

console.log(failures ? `\n${failures} FAILED, ${passes} passed` : `\nALL PASSED (${passes} checks)`);
process.exit(failures ? 1 : 0);
