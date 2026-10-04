#!/usr/bin/env node
// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
//
// Starts a server file (default dist/patent-connector.mjs) with plain JSON RPC
// over stdio, using only Node built ins, and checks that it starts, lists all
// tools with read only annotations, and answers a tool call without an API
// key with the plain English "no key" message (no network is used). Run it on
// a copy of the bundle in a folder with no node_modules to prove the bundle
// is self contained.
//
// Usage: node scripts/check-bundle.mjs [path/to/patent-connector.mjs]
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(process.argv[2] || path.join(here, "..", "dist", "patent-connector.mjs"));
const EXPECTED = ["get_document_text", "get_drawings", "get_patent", "get_patent_documents", "search_patents"];

const env = { ...process.env };
delete env.USPTO_ODP_API_KEY;
const child = spawn(process.execPath, [file], { cwd: path.dirname(file), env, stdio: ["pipe", "pipe", "inherit"] });
const pending = new Map();
let buffer = "";
child.stdout.on("data", (d) => {
  buffer += d;
  for (let i; (i = buffer.indexOf("\n")) >= 0; ) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    pending.get(msg.id)?.(msg);
  }
});
let nextId = 1;
const rpc = (method, params) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
const timer = setTimeout(() => {
  console.error("FAIL server did not answer within 15 seconds");
  child.kill();
  process.exit(1);
}, 15000);

let failures = 0;
const check = (label, cond, extra = "") => {
  console.log((cond ? "PASS " : "FAIL ") + label + (!cond && extra ? "  " + extra : ""));
  if (!cond) failures++;
};

console.log("Checking " + file);
const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "check-bundle", version: "1.0.0" } });
check("server starts and initializes", init.result?.serverInfo?.name === "patent-connector", JSON.stringify(init));
console.log("  version " + init.result?.serverInfo?.version);
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
const list = await rpc("tools/list", {});
const tools = list.result?.tools || [];
const names = tools.map((t) => t.name).sort();
check("lists all " + EXPECTED.length + " tools", names.join(",") === EXPECTED.join(","), names.join(","));
check(
  "every tool is read only",
  tools.every((t) => t.annotations?.readOnlyHint === true && t.annotations?.destructiveHint === false && t.annotations?.idempotentHint === true && t.annotations?.openWorldHint === true && t.annotations?.title)
);
const call = await rpc("tools/call", { name: "get_patent", arguments: { applicationNumber: "18483359" } });
const text = call.result?.content?.[0]?.text || "";
check("without a key, answers with the plain English setup message", call.result?.isError && /No USPTO API key is configured/.test(text) && /USPTO_ODP_API_KEY/.test(text), text);

clearTimeout(timer);
child.kill();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
