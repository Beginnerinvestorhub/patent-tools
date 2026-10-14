// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
//
// A small Model Context Protocol server over stdio (newline delimited
// JSON RPC 2.0). It implements only what this connector needs:
// initialize, ping, tools/list and tools/call. Written by hand so the
// plugin ships no third party code.

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_VERSION = SUPPORTED_VERSIONS[0];
const MAX_LINE_BYTES = 10 * 1024 * 1024;

const ERR = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603
};

export function serveStdio({ name, version, tools, callTool }) {
  const send = (msg) =>
    new Promise((resolve) => {
      if (process.stdout.write(JSON.stringify(msg) + "\n")) resolve();
      else process.stdout.once("drain", resolve);
    });
  const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
  const fail = (id, code, message) => send({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

  async function handle(msg) {
    if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0") {
      return fail(msg?.id, ERR.invalidRequest, "Invalid JSON RPC message");
    }
    const isRequest = msg.id !== undefined && msg.id !== null && typeof msg.method === "string";
    if (!isRequest) return; // notifications (initialized, cancelled) and stray responses need no answer

    const params = msg.params && typeof msg.params === "object" ? msg.params : {};
    switch (msg.method) {
      case "initialize": {
        const asked = String(params.protocolVersion || "");
        return reply(msg.id, {
          protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : LATEST_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name, version }
        });
      }
      case "ping":
        return reply(msg.id, {});
      case "tools/list":
        return reply(msg.id, { tools });
      case "tools/call": {
        if (typeof params.name !== "string") return fail(msg.id, ERR.invalidParams, "tools/call needs a tool name");
        const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
        try {
          return reply(msg.id, await callTool(params.name, args));
        } catch (err) {
          return fail(msg.id, ERR.internal, err?.message || String(err));
        }
      }
      default:
        return fail(msg.id, ERR.methodNotFound, "Method not found");
    }
  }

  let buffer = Buffer.alloc(0);
  process.stdin.on("data", (chunk) => {
    buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
    if (buffer.length > MAX_LINE_BYTES) {
      buffer = Buffer.alloc(0);
      fail(null, ERR.parse, "Message too large");
      return;
    }
    for (let nl; (nl = buffer.indexOf(10)) !== -1; ) {
      const line = buffer.toString("utf8", 0, nl).replace(/\r$/, "").trim();
      buffer = buffer.subarray(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        fail(null, ERR.parse, "Parse error");
        continue;
      }
      handle(msg).catch((err) => process.stderr.write("patent-connector: " + (err?.stack || err) + "\n"));
    }
  });
  process.stdin.on("end", () => process.exit(0));
}
