#!/usr/bin/env node
// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
// Patent Connector (USPTO)
// Local MCP server for the USPTO Open Data Portal (ODP) API at api.uspto.gov.
// Each user supplies their own free ODP API key (https://data.uspto.gov, My ODP).

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const VERSION = "1.1.1";
const API_KEY = (process.env.USPTO_ODP_API_KEY || "").trim();
const BASE_URL = "https://api.uspto.gov/api/v1";
const TIMEOUT_MS = 30000;

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

class UserError extends Error {}

function authHeaders() {
  if (!API_KEY) {
    throw new UserError(
      "No USPTO API key is configured. Get a free key at https://data.uspto.gov (sign in, then My ODP) and enter it in this extension's settings."
    );
  }
  return { "x-api-key": API_KEY };
}

function explainHttpError(status, bodyText, notFoundMessage) {
  if (status === 404) return notFoundMessage || "No matching records found at USPTO.";
  if (status === 401 || status === 403)
    return "USPTO rejected the API key (HTTP " + status + "). Check the key in this extension's settings; keys come from https://data.uspto.gov under My ODP.";
  if (status === 429)
    return "USPTO rate limit reached (HTTP 429). Wait a minute and try again, or make fewer requests in a row.";
  if (status === 400)
    return "USPTO could not parse the request (HTTP 400): " + bodyText.slice(0, 300);
  if (status >= 500)
    return "USPTO service error (HTTP " + status + "). The ODP API may be temporarily down; try again shortly.";
  return "USPTO API error " + status + ": " + bodyText.slice(0, 300);
}

// The API key is only ever sent over HTTPS to uspto.gov hosts. Redirects are
// followed by hand so the key is never forwarded to another host (Node's fetch
// would otherwise keep custom headers such as x-api-key on a cross host redirect).
const MAX_REDIRECTS = 5;
const MAX_BYTES = 25 * 1024 * 1024; // cap any single response at 25 MB

function isUsptoHttps(u) {
  return u.protocol === "https:" && (u.hostname === "uspto.gov" || u.hostname.endsWith(".uspto.gov"));
}

async function request(url, init = {}, notFoundMessage) {
  let target;
  try {
    target = new URL(url);
  } catch {
    throw new UserError("Refusing to fetch an invalid URL.");
  }
  if (!isUsptoHttps(target)) {
    throw new UserError("Refusing to contact " + target.host + ": requests must go to an HTTPS uspto.gov address.");
  }
  let method = init.method || "GET";
  let body = init.body;
  let res;
  for (let hop = 0; ; hop++) {
    const headers = { ...(init.headers || {}) };
    if (isUsptoHttps(target)) Object.assign(headers, authHeaders());
    try {
      res = await fetch(target, {
        method,
        body,
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof UserError) throw err;
      if (err?.name === "TimeoutError")
        throw new UserError("USPTO did not respond within " + TIMEOUT_MS / 1000 + " seconds. Try again.");
      throw new UserError("Could not reach USPTO: " + err.message);
    }
    if (![301, 302, 303, 307, 308].includes(res.status)) break;
    const location = res.headers.get("location");
    if (!location || hop >= MAX_REDIRECTS) throw new UserError("USPTO returned too many or invalid redirects.");
    const next = new URL(location, target);
    if (next.protocol !== "https:") throw new UserError("Refusing a redirect to a non HTTPS address.");
    if (res.status === 303 || ((res.status === 301 || res.status === 302) && method !== "GET")) {
      method = "GET";
      body = undefined;
    }
    target = next;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new UserError(explainHttpError(res.status, text, notFoundMessage));
  }
  return res;
}

async function readLimited(res) {
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) throw new UserError("USPTO response is too large to process (over 25 MB).");
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      throw new UserError("USPTO response is too large to process (over 25 MB).");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

async function getJson(path, notFoundMessage) {
  const res = await request(BASE_URL + path, {}, notFoundMessage);
  return JSON.parse((await readLimited(res)).toString("utf8"));
}

async function postJson(path, body) {
  const res = await request(BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return JSON.parse((await readLimited(res)).toString("utf8"));
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function normalizeAppNumber(raw) {
  const cleaned = String(raw ?? "").replace(/[\s,\/\-]/g, "").replace(/^US/i, "");
  if (!/^\d{6,10}$/.test(cleaned)) {
    throw new UserError(
      "'" + raw + "' is not a valid USPTO application number. Use the digits only, for example 16123456 or 16/123,456. Patent numbers (like 10123456 on a granted patent) are different; use search_patents to find the application number for a granted patent."
    );
  }
  return cleaned;
}

function checkDate(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value))) {
    throw new UserError(label + " must be a date in YYYY-MM-DD format, got '" + value + "'.");
  }
  return value;
}

function clampInt(value, def, min, max) {
  const n = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : def;
  return Math.min(Math.max(n, min), max);
}

// ---------------------------------------------------------------------------
// Query building
// ---------------------------------------------------------------------------

const SPECIAL = /[+\-!(){}\[\]^"~*?:\\\/]|&&|\|\|/g;
const escapeTerm = (t) => t.replace(SPECIAL, (m) => "\\" + m);

function buildQuery(query, matchMode) {
  const text = String(query ?? "").trim();
  if (!text) throw new UserError("query must not be empty.");
  if (matchMode === "advanced") return text;
  const plain = text.replace(/["]/g, " ").trim();
  if (matchMode === "phrase") return '"' + plain.replace(/\\/g, "") + '"';
  const terms = plain.split(/\s+/).filter(Boolean).map(escapeTerm);
  if (terms.length === 1) return terms[0];
  return "(" + terms.join(matchMode === "any" ? " OR " : " AND ") + ")";
}

// ---------------------------------------------------------------------------
// Response shaping
// ---------------------------------------------------------------------------

const isReexam = (meta) =>
  /reexam/i.test(meta?.applicationTypeLabelName || "") || meta?.applicationTypeCode === "REX";

function summarizeSearchItem(item) {
  const m = item.applicationMetaData || {};
  const out = {
    applicationNumber: item.applicationNumberText,
    title: m.inventionTitle,
    filingDate: m.filingDate,
    status: m.applicationStatusDescriptionText,
    patentNumber: m.patentNumber,
    grantDate: m.grantDate,
    firstApplicant: m.firstApplicantName,
    firstInventor: m.firstInventorName,
  };
  // USPTO stores the patent under reexamination in the inventor field for reexam records.
  if (isReexam(m) || /^\d{6,9}$/.test(String(m.firstInventorName || ""))) {
    out.reexaminationOfPatent = m.firstInventorName;
    delete out.firstInventor;
  }
  return dropEmpty(out);
}

function dropEmpty(obj) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) delete obj[k];
  }
  return obj;
}

function summarizeApplication(w) {
  const m = w.applicationMetaData || {};
  const assignees = new Set();
  for (const a of w.assignmentBag || []) {
    for (const s of a.assigneeBag || []) if (s.assigneeNameText) assignees.add(s.assigneeNameText);
  }
  const events = (w.eventDataBag || [])
    .slice()
    .sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)))
    .slice(0, 10)
    .map((e) => ({ date: e.eventDate, event: e.eventDescriptionText }));
  const out = {
    applicationNumber: w.applicationNumberText,
    title: m.inventionTitle,
    applicationType: m.applicationTypeLabelName,
    status: m.applicationStatusDescriptionText,
    statusDate: m.applicationStatusDate,
    filingDate: m.filingDate,
    effectiveFilingDate: m.effectiveFilingDate,
    firstInventorToFile: m.firstInventorToFileIndicator,
    patentNumber: m.patentNumber,
    grantDate: m.grantDate,
    publicationNumber: m.earliestPublicationNumber,
    publicationDate: m.earliestPublicationDate,
    inventors: (m.inventorBag || []).map((i) => i.inventorNameText).filter(Boolean),
    applicants: (m.applicantBag || []).map((a) => a.applicantNameText).filter(Boolean),
    assignees: [...assignees],
    cpcClassifications: (m.cpcClassificationBag || []).map((c) => String(c).replace(/\s+/g, " ")),
    examiner: m.examinerNameText,
    groupArtUnit: m.groupArtUnitNumber,
    entityStatus: m.entityStatusData?.businessEntityStatusCategory,
    parentApplications: (w.parentContinuityBag || []).map((p) =>
      dropEmpty({
        applicationNumber: p.parentApplicationNumberText,
        relationship: p.claimParentageTypeCodeDescriptionText,
        filingDate: p.parentApplicationFilingDate,
        patentNumber: p.parentPatentNumber,
      })
    ),
    patentTermAdjustmentDays: w.patentTermAdjustmentData?.adjustmentTotalQuantity,
    recentEvents: events,
    patentCenterUrl: "https://patentcenter.uspto.gov/applications/" + w.applicationNumberText,
  };
  if (isReexam(m)) {
    out.reexaminationOfPatent = m.firstInventorName;
    out.inventors = [];
  }
  return dropEmpty(out);
}

// Document codes most useful for prior art and prosecution review.
const KEY_CODES = new Set([
  "ABST", "CLM", "SPEC", "DRW", "DRW.NONBW", "CTNF", "CTFR", "CTRS", "CTEQ",
  "NOA", "892", "IDS", "1449", "REM", "SRFW", "SRNT", "ISR", "WOSA",
]);

function summarizeDocument(d) {
  const opts = d.downloadOptionBag || [];
  const pdf = opts.find((o) => o.mimeTypeIdentifier === "PDF");
  return dropEmpty({
    documentId: d.documentIdentifier,
    code: d.documentCode,
    description: d.documentCodeDescriptionText,
    date: String(d.officialDate || "").slice(0, 10),
    direction: d.directionCategory,
    pages: pdf?.pageTotalQuantity,
    textAvailable: opts.some((o) => o.mimeTypeIdentifier === "XML"),
  });
}

// ---------------------------------------------------------------------------
// Document text extraction (xmlarchive downloads are tar files holding XML)
// ---------------------------------------------------------------------------

function readTar(buf) {
  const files = [];
  let off = 0;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const str = (s, e) => header.subarray(s, e).toString("utf8").replace(/\0.*$/s, "");
    const name = (str(345, 500) ? str(345, 500) + "/" : "") + str(0, 100);
    const size = parseInt(str(124, 136).trim() || "0", 8) || 0;
    const type = String.fromCharCode(header[156] || 48);
    const start = off + 512;
    if (type === "0" || type === "\0") files.push({ name, data: buf.subarray(start, start + size) });
    off = start + Math.ceil(size / 512) * 512;
  }
  return files;
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function xmlToText(xml) {
  const text = xml
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<uspat:DocumentMetadata[\s\S]*?<\/uspat:DocumentMetadata>/g, "")
    // Embedded figures, chemistry and math images carry file names and
    // metadata as text nodes; drop them entirely.
    .replace(/<([\w.]+:)?(Image|Chemistry|Math|Table|InlineFigure)\b[^>]*\/>/g, " ")
    .replace(/<([\w.]+:)?(Image|Chemistry|Math|InlineFigure)\b[^>]*>[\s\S]*?<\/\1?\2>/g, " ")
    .replace(/<([\w.]+:)?OCRConfidenceData\b[^>]*>[\s\S]*?<\/\1?OCRConfidenceData>/g, (m) => m.replace(/<[^>]+>/g, ""))
    .replace(/<\/?[\w.]*:?(P|Heading|Claim|ClaimText|Paragraph|Abstract|li|br)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

async function fetchDocumentText(appNo, { documentId, documentCode }) {
  const list = await getJson(
    "/patent/applications/" + appNo + "/documents",
    "No application " + appNo + " was found at USPTO."
  );
  const docs = list.documentBag || [];
  let doc;
  if (documentId) {
    doc = docs.find((d) => d.documentIdentifier === documentId);
    if (!doc) throw new UserError("Document " + documentId + " was not found in application " + appNo + ". Use get_patent_documents to list valid document IDs.");
  } else {
    const code = String(documentCode || "CLM").toUpperCase();
    doc = docs
      .filter((d) => d.documentCode === code && (d.downloadOptionBag || []).some((o) => o.mimeTypeIdentifier === "XML"))
      .sort((a, b) => String(b.officialDate).localeCompare(String(a.officialDate)))[0];
    if (!doc) throw new UserError("Application " + appNo + " has no " + code + " document with text available. Use get_patent_documents to see what exists.");
  }
  const xmlOpt = (doc.downloadOptionBag || []).find((o) => o.mimeTypeIdentifier === "XML");
  if (!xmlOpt) {
    throw new UserError(
      "Document " + doc.documentIdentifier + " (" + doc.documentCodeDescriptionText + ") is only available as a scanned PDF, so its text cannot be extracted. Drawings and most office forms are image only."
    );
  }
  const res = await request(xmlOpt.downloadUrl);
  const buf = await readLimited(res);
  let xml;
  if (buf.subarray(0, 5).toString() === "<?xml" || buf[0] === 0x3c) {
    xml = buf.toString("utf8");
  } else {
    const entry = readTar(buf).find((f) => /\.xml$/i.test(f.name));
    if (!entry) throw new UserError("USPTO returned an archive without XML text for this document.");
    xml = entry.data.toString("utf8");
  }
  return { doc, text: xmlToText(xml) };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const APP_NO = {
  type: "string",
  description: "USPTO application number, digits only (e.g. '16123456'). Slashes and commas like '16/123,456' are accepted.",
};

const TOOLS = [
  {
    name: "search_patents",
    title: "Search USPTO patents and applications",
    description:
      "Search USPTO patent applications and granted patents (live Open Data Portal data, applications filed 2001 onward). Matches against titles and bibliographic data such as applicant, inventor and classification; it does not search the full text of claims or descriptions. Use this first for prior art and landscape searches, then call get_patent or get_document_text on promising results. By default every word must match; use matchMode 'phrase' for an exact phrase, 'any' for broad recall, or 'advanced' for raw field syntax such as applicationMetaData.inventionTitle:(battery AND anode) or applicationMetaData.firstApplicantName:\"Apple Inc.\".",
    annotations: { title: "Search USPTO patents and applications", ...READ_ONLY },
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to search for, e.g. 'data isolation access control'." },
        matchMode: {
          type: "string",
          enum: ["all", "phrase", "any", "advanced"],
          default: "all",
          description: "all: every word must match (default). phrase: exact phrase. any: at least one word. advanced: pass the query to USPTO unchanged (field:value syntax, AND/OR/NOT, wildcards).",
        },
        filingDateFrom: { type: "string", description: "Optional. Only include applications filed on or after this date (YYYY-MM-DD)." },
        filingDateTo: { type: "string", description: "Optional. Only include applications filed on or before this date (YYYY-MM-DD). For prior art, set this to the day before your own filing or priority date." },
        grantedOnly: { type: "boolean", default: false, description: "Only return applications that issued as patents." },
        sort: {
          type: "string",
          enum: ["relevance", "newest", "oldest"],
          default: "relevance",
          description: "Result order by filing date, or USPTO default relevance.",
        },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10, description: "Results per page (1 to 50, default 10)." },
        offset: { type: "integer", minimum: 0, default: 0, description: "Results to skip, for paging (default 0)." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_patent",
    title: "Get patent application details",
    description:
      "Get a concise summary of one USPTO application or granted patent: title, status, key dates, patent number, inventors, applicants, assignees, CPC classes, examiner and art unit, parent applications and recent prosecution events. Use after search_patents when you need detail on a specific result.",
    annotations: { title: "Get patent application details", ...READ_ONLY },
    inputSchema: {
      type: "object",
      properties: { applicationNumber: APP_NO },
      required: ["applicationNumber"],
    },
  },
  {
    name: "get_patent_documents",
    title: "List documents in a patent file",
    description:
      "List the documents in an application's file wrapper (claims, specification, abstract, drawings, office actions, examiner citations, notices of allowance and more), newest first. Each entry shows its documentId and whether text can be extracted. Use this to find a specific document, then call get_document_text to read it.",
    annotations: { title: "List documents in a patent file", ...READ_ONLY },
    inputSchema: {
      type: "object",
      properties: {
        applicationNumber: APP_NO,
        filter: {
          type: "string",
          enum: ["key", "all"],
          default: "key",
          description: "key (default): claims, specification, abstract, drawings, office actions, examiner citations, allowance and search reports. all: every document including fee sheets and receipts.",
        },
      },
      required: ["applicationNumber"],
    },
  },
  {
    name: "get_document_text",
    title: "Read the text of a patent document",
    description:
      "Download a document from an application's file wrapper and return its plain text, so you can read and compare claims, abstracts and specifications. Give either documentCode (returns the most recent document of that type, default CLM for claims) or a documentId from get_patent_documents. Text comes from USPTO OCR and may contain small recognition errors. Drawings and most forms are scanned images with no text. Long documents are returned in pages; use startChar to continue.",
    annotations: { title: "Read the text of a patent document", ...READ_ONLY },
    inputSchema: {
      type: "object",
      properties: {
        applicationNumber: APP_NO,
        documentCode: {
          type: "string",
          description: "Document type to fetch the latest version of: CLM (claims, default), ABST (abstract), SPEC (specification), REM (applicant remarks), CTNF or CTFR (office actions, when text is available).",
        },
        documentId: { type: "string", description: "Exact documentId from get_patent_documents. Overrides documentCode." },
        startChar: { type: "integer", minimum: 0, default: 0, description: "Character offset to start from, for reading long documents in pages." },
        maxChars: { type: "integer", minimum: 1000, maximum: 60000, default: 20000, description: "Maximum characters to return (default 20000)." },
      },
      required: ["applicationNumber"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function searchPatents(args) {
  const matchMode = ["all", "phrase", "any", "advanced"].includes(args.matchMode) ? args.matchMode : "all";
  let q = buildQuery(args.query, matchMode);
  if (args.grantedOnly) q = "(" + q + ") AND applicationMetaData.patentNumber:*";
  const from = checkDate(args.filingDateFrom, "filingDateFrom");
  const to = checkDate(args.filingDateTo, "filingDateTo");
  const limit = clampInt(args.limit, 10, 1, 50);
  const offset = clampInt(args.offset, 0, 0, 10000);
  const body = {
    q,
    pagination: { offset, limit },
    fields: [
      "applicationNumberText",
      "applicationMetaData.inventionTitle",
      "applicationMetaData.filingDate",
      "applicationMetaData.applicationStatusDescriptionText",
      "applicationMetaData.patentNumber",
      "applicationMetaData.grantDate",
      "applicationMetaData.firstApplicantName",
      "applicationMetaData.firstInventorName",
      "applicationMetaData.applicationTypeLabelName",
    ],
  };
  if (from || to) {
    body.rangeFilters = [
      { field: "applicationMetaData.filingDate", valueFrom: from || "1790-01-01", valueTo: to || "2999-12-31" },
    ];
  }
  if (args.sort === "newest" || args.sort === "oldest") {
    body.sort = [{ field: "applicationMetaData.filingDate", order: args.sort === "newest" ? "desc" : "asc" }];
  }
  let data;
  try {
    data = await postJson("/patent/applications/search", body);
  } catch (err) {
    // USPTO answers 404 when nothing matches; treat that as an empty result.
    if (err instanceof UserError && /No matching records/.test(err.message)) data = { count: 0 };
    else throw err;
  }
  const results = (data.patentFileWrapperDataBag || []).map(summarizeSearchItem);
  const total = data.count ?? 0;
  const out = { totalMatches: total, offset, returned: results.length, queryUsed: q, results };
  if (offset + results.length < total) out.nextOffset = offset + results.length;
  if (total > 1000 && matchMode !== "phrase")
    out.tip = "Very broad result set. Try matchMode 'phrase', add more specific words, or narrow by filing date.";
  return out;
}

async function getPatent(args) {
  const appNo = normalizeAppNumber(args.applicationNumber);
  const data = await getJson(
    "/patent/applications/" + appNo,
    "No application " + appNo + " was found at USPTO. If this is a granted patent number, search for it with search_patents using matchMode 'advanced' and the query applicationMetaData.patentNumber:" + appNo + "."
  );
  const w = (data.patentFileWrapperDataBag || [])[0];
  if (!w) throw new UserError("No application " + appNo + " was found at USPTO.");
  return summarizeApplication(w);
}

async function getPatentDocuments(args) {
  const appNo = normalizeAppNumber(args.applicationNumber);
  const data = await getJson(
    "/patent/applications/" + appNo + "/documents",
    "No application " + appNo + " was found at USPTO."
  );
  const all = (data.documentBag || [])
    .slice()
    .sort((a, b) => String(b.officialDate).localeCompare(String(a.officialDate)));
  const filter = args.filter === "all" ? "all" : "key";
  const docs = filter === "all" ? all : all.filter((d) => KEY_CODES.has(d.documentCode));
  return {
    applicationNumber: appNo,
    totalDocuments: all.length,
    shown: docs.length,
    filter,
    documents: docs.map(summarizeDocument),
  };
}

async function getDocumentText(args) {
  const appNo = normalizeAppNumber(args.applicationNumber);
  if (args.documentId && !/^[A-Za-z0-9.\-_]{4,80}$/.test(args.documentId)) {
    throw new UserError("documentId '" + args.documentId + "' does not look valid. Copy it exactly from get_patent_documents.");
  }
  const { doc, text } = await fetchDocumentText(appNo, args);
  const start = clampInt(args.startChar, 0, 0, Math.max(text.length, 0));
  const max = clampInt(args.maxChars, 20000, 1000, 60000);
  const slice = text.slice(start, start + max);
  const out = {
    applicationNumber: appNo,
    documentId: doc.documentIdentifier,
    code: doc.documentCode,
    description: doc.documentCodeDescriptionText,
    date: String(doc.officialDate || "").slice(0, 10),
    totalChars: text.length,
    startChar: start,
    returnedChars: slice.length,
    note: "Text is from USPTO OCR and may contain minor recognition errors.",
    text: slice,
  };
  if (start + slice.length < text.length) out.nextStartChar = start + slice.length;
  return out;
}

const HANDLERS = {
  search_patents: searchPatents,
  get_patent: getPatent,
  get_patent_documents: getPatentDocuments,
  get_document_text: getDocumentText,
};

// ---------------------------------------------------------------------------
// Server wiring
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "patent-connector", version: VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const handler = HANDLERS[name];
  try {
    if (!handler) throw new UserError("Unknown tool: " + name);
    const data = await handler(args);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    const message = err instanceof UserError ? err.message : "Unexpected error: " + (err?.message || String(err));
    return { content: [{ type: "text", text: "Error: " + message }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
