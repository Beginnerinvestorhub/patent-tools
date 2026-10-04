// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
// Offline retry tests: transient USPTO errors (429, 502, 503, 504) are retried
// politely, other client errors are not.
// Run: node test/retry.mjs   (no API key or network needed)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
// --bundle runs the same tests against the committed single file bundle
// (dist/patent-connector.mjs, made by npm run build) instead of index.js.
const SERVER = process.argv.includes("--bundle")
  ? path.join(here, "..", "dist", "patent-connector.mjs")
  : path.join(here, "..", "index.js");
console.log("Server under test: " + path.relative(path.join(here, ".."), SERVER));
let failures = 0;
const check = (label, cond, extra = "") => {
  console.log((cond ? "PASS " : "FAIL ") + label + (!cond && extra ? "  " + extra : ""));
  if (!cond) failures++;
};

// scale 0 makes every backoff wait instant; scale 0.01 turns 10 s into 100 ms.
async function run(scenario, scale = "0") {
  const log = path.join(os.tmpdir(), `pc-retry-${scenario}-${process.pid}.log`);
  fs.writeFileSync(log, "");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", pathToFileURL(path.join(here, "mock-fetch.mjs")).href, SERVER],
    env: { ...process.env, USPTO_ODP_API_KEY: "TEST_KEY", MOCK_SCENARIO: scenario, MOCK_LOG: log, PATENT_CONNECTOR_RETRY_SCALE: scale },
  });
  const client = new Client({ name: "retry", version: "1.0.0" });
  await client.connect(transport);
  const r = await client.callTool({ name: "get_patent", arguments: { applicationNumber: "16123456" } });
  await client.close();
  const calls = fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  fs.rmSync(log, { force: true });
  return { isError: !!r.isError, text: r.content?.[0]?.text || "", calls };
}

let r = await run("retry-429-once");
check("429 then success: succeeds", !r.isError && r.text.includes("Retry test widget"), r.text);
check("429 then success: exactly 2 fetch calls", r.calls.length === 2, "calls=" + r.calls.length);

r = await run("retry-429-always");
check("429 three times: plain English rate limit error", r.isError && /rate limit reached \(HTTP 429\)/.test(r.text), r.text);
check("429 three times: exactly 3 fetch calls", r.calls.length === 3, "calls=" + r.calls.length);

r = await run("retry-503-twice");
check("503 twice then success: succeeds after 3 calls", !r.isError && r.calls.length === 3, "calls=" + r.calls.length + " " + r.text);

r = await run("retry-400");
check("400 is never retried", r.isError && r.calls.length === 1 && /HTTP 400/.test(r.text), "calls=" + r.calls.length);

r = await run("retry-404");
check("404 is never retried", r.isError && r.calls.length === 1 && /No application/.test(r.text), "calls=" + r.calls.length);

r = await run("retry-after-capped", "0.01");
const gap = r.calls.length === 2 ? r.calls[1].t - r.calls[0].t : -1;
check("Retry-After 30 is honored but capped at 10 s (100 ms at test scale)", !r.isError && gap >= 90 && gap < 250, "gap=" + gap + "ms");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
