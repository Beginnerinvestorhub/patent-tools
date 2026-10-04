// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
// Offline security tests: API key containment, redirect handling, size cap.
// Run: node test/security.mjs   (no API key or network needed)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const KEY = "TEST_KEY_DO_NOT_LEAK";
let failures = 0;
const check = (label, cond, extra = "") => {
  console.log((cond ? "PASS " : "FAIL ") + label + (!cond && extra ? "  " + extra : ""));
  if (!cond) failures++;
};

async function run(scenario) {
  const log = path.join(os.tmpdir(), `pc-sec-${scenario}-${process.pid}.log`);
  fs.writeFileSync(log, "");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", pathToFileURL(path.join(here, "mock-fetch.mjs")).href, path.join(here, "..", "index.js")],
    env: { ...process.env, USPTO_ODP_API_KEY: KEY, MOCK_SCENARIO: scenario, MOCK_LOG: log },
  });
  const client = new Client({ name: "sec", version: "1.0.0" });
  await client.connect(transport);
  const r = await client.callTool({ name: "get_document_text", arguments: { applicationNumber: "16123456" } });
  await client.close();
  const calls = fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  fs.rmSync(log, { force: true });
  return { isError: !!r.isError, text: r.content?.[0]?.text || "", calls };
}

const outputs = [];
const _run = run;
async function runAndKeep(sc) { const res = await _run(sc); outputs.push(res.text); return res; }

let r = await runAndKeep("normal");
check("normal download works", !r.isError && r.text.includes("receiving data"), r.text);
check("key sent only to api.uspto.gov", r.calls.every((c) => c.host === "api.uspto.gov" && c.protocol === "https:"));

r = await runAndKeep("evil-downloadurl");
check("download link to another host is refused", r.isError && /Refusing to contact/.test(r.text), r.text);
check("other host never contacted", !r.calls.some((c) => c.host === "evil.example.com"));

r = await runAndKeep("redirect-offsite");
const cdn = r.calls.filter((c) => c.host === "cdn.example.net");
check("redirect off USPTO still downloads", !r.isError && r.text.includes("receiving data"), r.text);
check("key NOT forwarded on redirect off USPTO", cdn.length === 1 && cdn[0].key === null, JSON.stringify(cdn));

r = await runAndKeep("redirect-http");
check("redirect to plain HTTP is refused", r.isError && /non HTTPS/.test(r.text), r.text);
check("no plain HTTP request made", !r.calls.some((c) => c.protocol === "http:"));

r = await runAndKeep("huge");
check("oversized response is refused", r.isError && /too large/.test(r.text), r.text);

check("key never appears in any tool output", outputs.length === 5 && !outputs.some((t) => t.includes(KEY)));

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
