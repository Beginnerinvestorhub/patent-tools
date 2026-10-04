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
import { PdfDocument, PdfError, UnsupportedImageError, extractPageImage } from "./lib/pdf.js";
import { downscale, orient, encodePngGray } from "./lib/raster.js";

const VERSION = "1.3.0";
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
      "No USPTO API key is configured. Get a free key at https://data.uspto.gov (sign in, then My ODP). In Claude Desktop, enter it in this extension's settings. When running as a plugin (Claude Code and other hosts), set the USPTO_ODP_API_KEY environment variable and fully restart the app."
    );
  }
  return { "x-api-key": API_KEY };
}

function explainHttpError(status, bodyText, notFoundMessage) {
  if (status === 404) return notFoundMessage || "No matching records found at USPTO.";
  if (status === 401 || status === 403)
    return "USPTO rejected the API key (HTTP " + status + "). Check the key in this extension's settings, or the USPTO_ODP_API_KEY environment variable when running as a plugin; keys come from https://data.uspto.gov under My ODP.";
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

// Polite retry for transient USPTO errors: rate limiting (429) and gateway
// or availability errors (502, 503, 504). At most 2 retries after the first
// attempt. A numeric Retry-After header is honored, capped at 10 seconds;
// otherwise the waits are 1 s and then 3 s. No other 4xx is ever retried.
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const RETRY_DELAYS_MS = [1000, 3000];
const RETRY_AFTER_CAP_MS = 10000;
// Test only knob: scales every wait (0 makes the offline tests instant).
const RETRY_SCALE = (() => {
  const n = Number(process.env.PATENT_CONNECTOR_RETRY_SCALE);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 1;
})();

function retryDelayMs(res, attempt) {
  const header = (res.headers.get("retry-after") || "").trim();
  let ms = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
  if (/^\d+(\.\d+)?$/.test(header)) ms = Math.min(Number(header) * 1000, RETRY_AFTER_CAP_MS);
  return ms * RETRY_SCALE;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    for (let attempt = 0; ; attempt++) {
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
      if (!RETRY_STATUSES.has(res.status) || attempt >= RETRY_DELAYS_MS.length) break;
      const wait = retryDelayMs(res, attempt);
      await res.body?.cancel().catch(() => {});
      await sleep(wait);
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
      "'" + raw + "' is not a valid USPTO application number. Use the digits only, for example 16123456 or 16/123,456. For a granted patent, pass its number as patentNumber instead (for example 12,399,789)."
    );
  }
  return cleaned;
}

// US patent numbers as people write them: "12399789", "12,399,789",
// "US 12,399,789 B1", "US12399789", "D987,654", "RE49,123", "PP12,345".
// Returns the forms to try against applicationMetaData.patentNumber (plain
// digits for utility patents; the letter prefix plus digits for design,
// reissue, plant and statutory invention registration numbers, first as
// written and then zero padded to 8 characters the way USPTO full text data
// writes them, such as D0987654 or RE049123) and a display form.
const PATENT_PREFIXES = ["RE", "PP", "D", "H"];

function normalizePatentNumber(raw) {
  const cleaned = String(raw ?? "").toUpperCase().replace(/[\s,.]/g, "");
  const m = cleaned.match(/^(?:US)?(RE|PP|D|H)?(\d{1,8})(?:[A-Z]\d?)?$/);
  const digits = m ? m[2].replace(/^0+/, "") : "";
  if (!m || !digits) {
    const pub = /^(?:US)?(19|20)\d{2}\/?\d{7}(?:[A-Z]\d?)?$/.test(cleaned);
    throw new UserError(
      "'" + raw + "' does not look like a US patent number. Examples: 12399789, 12,399,789, US 12,399,789 B1, D987,654 or RE49,123." +
        (pub
          ? " That looks like a publication number; find its application with search_patents instead."
          : " Application numbers (like 16/123,456) go in applicationNumber instead.")
    );
  }
  const prefix = m[1] || "";
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const candidates = [prefix + digits];
  if (prefix && prefix.length + digits.length < 8) candidates.push(prefix + digits.padStart(8 - prefix.length, "0"));
  return { prefix, digits, candidates, display: "US " + prefix + grouped };
}

const canonPatent = (v) =>
  String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^([A-Z]*)0+/, "$1");

async function resolvePatentNumber(raw) {
  const pn = normalizePatentNumber(raw);
  for (const candidate of pn.candidates) {
    let data;
    try {
      data = await postJson("/patent/applications/search", {
        q: "applicationMetaData.patentNumber:" + candidate,
        pagination: { offset: 0, limit: 5 },
        fields: [
          "applicationNumberText",
          "applicationMetaData.patentNumber",
          "applicationMetaData.inventionTitle",
          "applicationMetaData.applicationTypeLabelName",
          "applicationMetaData.applicationTypeCode",
        ],
      });
    } catch (err) {
      // USPTO answers 404 when nothing matches.
      if (err instanceof UserError && /No matching records/.test(err.message)) continue;
      throw err;
    }
    const hits = (data.patentFileWrapperDataBag || []).filter((w) => {
      const stored = w.applicationMetaData?.patentNumber;
      return /^\d{6,10}$/.test(String(w.applicationNumberText || "")) &&
        (stored === undefined || stored === null || canonPatent(stored) === canonPatent(candidate));
    });
    if (!hits.length) continue;
    // A reexamination record can mention the same patent; prefer the original.
    const best = hits.find((w) => !isReexam(w.applicationMetaData)) || hits[0];
    return {
      applicationNumber: best.applicationNumberText,
      display: pn.display,
      note: "Patent " + pn.display + " resolved to application " + best.applicationNumberText + ".",
    };
  }
  throw new UserError(
    "No USPTO application with patent number " + pn.display + " was found. Check the number; the Open Data Portal covers applications filed from 2001 onward, so older patents are not included." +
      (pn.prefix
        ? " Design (D), reissue (RE), plant (PP) and H numbers are looked up the way USPTO writes them (for example D987654); if this one is not found, find its application with search_patents and use applicationNumber."
        : "")
  );
}

const given = (v) => v !== undefined && v !== null && String(v).trim() !== "";

// Every per application tool takes applicationNumber OR patentNumber.
async function resolveApplication(args) {
  const hasApp = given(args.applicationNumber);
  const hasPat = given(args.patentNumber);
  if (hasApp && hasPat)
    throw new UserError("Give either applicationNumber or patentNumber, not both.");
  if (!hasApp && !hasPat)
    throw new UserError("Give either applicationNumber (for example 18483359) or patentNumber (for example 12,399,789).");
  if (hasApp) return { appNo: normalizeAppNumber(args.applicationNumber), lookup: null };
  const r = await resolvePatentNumber(args.patentNumber);
  return { appNo: normalizeAppNumber(r.applicationNumber), lookup: r };
}

// Puts the patent number lookup note first in a result object.
const withLookup = (lookup, obj) => (lookup ? { patentNumberLookup: lookup.note, ...obj } : obj);

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
      "Document " + doc.documentIdentifier + " (" + doc.documentCodeDescriptionText + ") is only available as a scanned PDF, so its text cannot be extracted. Drawings and most office forms are image only; use get_drawings to view drawings as images."
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
  description: "USPTO application number, digits only (e.g. '16123456'). Slashes and commas like '16/123,456' are accepted. Give this or patentNumber, not both.",
};

const PATENT_NO = {
  type: "string",
  description: "Granted US patent number, used instead of applicationNumber, e.g. '12399789', '12,399,789' or 'US 12,399,789 B1'. Design and reissue numbers like 'D987,654' or 'RE49,123' are tried as USPTO writes them. Give this or applicationNumber, not both.",
};

const ONE_OF_NOTE = " Give either applicationNumber or patentNumber (a granted patent number is looked up to its application first).";

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
      "Get a concise summary of one USPTO application or granted patent: title, status, key dates, patent number, inventors, applicants, assignees, CPC classes, examiner and art unit, parent applications and recent prosecution events. Use after search_patents when you need detail on a specific result." + ONE_OF_NOTE,
    annotations: { title: "Get patent application details", ...READ_ONLY },
    inputSchema: {
      type: "object",
      properties: { applicationNumber: APP_NO, patentNumber: PATENT_NO },
    },
  },
  {
    name: "get_patent_documents",
    title: "List documents in a patent file",
    description:
      "List the documents in an application's file wrapper (claims, specification, abstract, drawings, office actions, examiner citations, notices of allowance and more), newest first. Each entry shows its documentId and whether text can be extracted. Use this to find a specific document, then call get_document_text to read it or get_drawings to view drawings." + ONE_OF_NOTE,
    annotations: { title: "List documents in a patent file", ...READ_ONLY },
    inputSchema: {
      type: "object",
      properties: {
        applicationNumber: APP_NO,
        patentNumber: PATENT_NO,
        filter: {
          type: "string",
          enum: ["key", "all"],
          default: "key",
          description: "key (default): claims, specification, abstract, drawings, office actions, examiner citations, allowance and search reports. all: every document including fee sheets and receipts.",
        },
      },
    },
  },
  {
    name: "get_document_text",
    title: "Read the text of a patent document",
    description:
      "Download a document from an application's file wrapper and return its plain text, so you can read and compare claims, abstracts and specifications. Give either documentCode (returns the most recent document of that type, default CLM for claims) or a documentId from get_patent_documents. Text comes from USPTO OCR and may contain small recognition errors. Drawings and most forms are scanned images with no text; view drawings with get_drawings. Long documents are returned in pages; use startChar to continue." + ONE_OF_NOTE,
    annotations: { title: "Read the text of a patent document", ...READ_ONLY },
    inputSchema: {
      type: "object",
      properties: {
        applicationNumber: APP_NO,
        patentNumber: PATENT_NO,
        documentCode: {
          type: "string",
          description: "Document type to fetch the latest version of: CLM (claims, default), ABST (abstract), SPEC (specification), REM (applicant remarks), CTNF or CTFR (office actions, when text is available).",
        },
        documentId: { type: "string", description: "Exact documentId from get_patent_documents. Overrides documentCode." },
        startChar: { type: "integer", minimum: 0, default: 0, description: "Character offset to start from, for reading long documents in pages." },
        maxChars: { type: "integer", minimum: 1000, maximum: 60000, default: 20000, description: "Maximum characters to return (default 20000)." },
      },
    },
  },
  {
    name: "get_drawings",
    title: "View patent drawings",
    description:
      "Show the drawing sheets of a USPTO application or granted patent as images, so you can look at the figures (for example prior art drawings). Downloads the drawings document (DRW, the most recent one unless documentId is given), and returns one PNG image per page plus a short summary. Returns pages 1 to 3 by default and at most 5 pages per call; ask for more with pages, for example '4-6'." + ONE_OF_NOTE,
    annotations: { title: "View patent drawings", ...READ_ONLY },
    inputSchema: {
      type: "object",
      properties: {
        applicationNumber: APP_NO,
        patentNumber: PATENT_NO,
        documentId: { type: "string", description: "Optional. Exact documentId from get_patent_documents (for example an older or replacement drawings document). Defaults to the most recent drawings document." },
        pages: { type: "string", description: "Optional. Pages to show, 1 based: a single page '2', a range '1-3' or a list '2,4'. Default: the first 3 pages. At most 5 pages per call." },
        maxDimension: { type: "integer", minimum: 600, maximum: 2400, default: 1600, description: "Optional. Longest side of each image in pixels (600 to 2400, default 1600). Larger values make small reference numerals easier to read." },
      },
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
  const { appNo, lookup } = await resolveApplication(args);
  const data = await getJson(
    "/patent/applications/" + appNo,
    "No application " + appNo + " was found at USPTO." + (lookup ? "" : " If this is a granted patent number, pass it as patentNumber instead.")
  );
  const w = (data.patentFileWrapperDataBag || [])[0];
  if (!w) throw new UserError("No application " + appNo + " was found at USPTO.");
  return withLookup(lookup, summarizeApplication(w));
}

async function getPatentDocuments(args) {
  const { appNo, lookup } = await resolveApplication(args);
  const data = await getJson(
    "/patent/applications/" + appNo + "/documents",
    "No application " + appNo + " was found at USPTO."
  );
  const all = (data.documentBag || [])
    .slice()
    .sort((a, b) => String(b.officialDate).localeCompare(String(a.officialDate)));
  const filter = args.filter === "all" ? "all" : "key";
  const docs = filter === "all" ? all : all.filter((d) => KEY_CODES.has(d.documentCode));
  return withLookup(lookup, {
    applicationNumber: appNo,
    totalDocuments: all.length,
    shown: docs.length,
    filter,
    documents: docs.map(summarizeDocument),
  });
}

function checkDocumentId(documentId) {
  if (documentId && !/^[A-Za-z0-9.\-_]{4,80}$/.test(documentId)) {
    throw new UserError("documentId '" + documentId + "' does not look valid. Copy it exactly from get_patent_documents.");
  }
}

async function getDocumentText(args) {
  checkDocumentId(args.documentId);
  const { appNo, lookup } = await resolveApplication(args);
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
  return withLookup(lookup, out);
}

// ---------------------------------------------------------------------------
// Drawings as images
// ---------------------------------------------------------------------------

const DRAWING_CODES = ["DRW", "DRW.NONBW"];
const MAX_DRAWING_PAGES = 5;
const DEFAULT_DRAWING_PAGES = 3;
const MAX_PNG_BYTES = 1024 * 1024; // shrink further if a page would exceed this
// Marks a handler result that is already MCP content (text plus images).
const CONTENT = Symbol("content");

// "2", "1-3", "2,4", "1-2,5" -> sorted unique 1 based page numbers.
function parsePages(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const text = String(raw).replace(/\s+/g, "");
  const pages = new Set();
  for (const part of text.split(",")) {
    const m = part.match(/^(\d{1,5})(?:[-\u2013](\d{1,5}))?$/);
    const a = m ? Number(m[1]) : NaN;
    const b = m && m[2] ? Number(m[2]) : a;
    if (!m || a < 1 || b < a)
      throw new UserError("pages '" + raw + "' is not valid. Use a page number like '2', a range like '1-3', or a list like '2,4' (pages start at 1).");
    for (let p = a; p <= b && pages.size <= MAX_DRAWING_PAGES; p++) pages.add(p);
    if (pages.size > MAX_DRAWING_PAGES) break;
  }
  if (pages.size > MAX_DRAWING_PAGES)
    throw new UserError("get_drawings returns at most " + MAX_DRAWING_PAGES + " pages per call. Ask for fewer pages, then call again for the rest (for example '1-5', then '6-10').");
  return [...pages].sort((x, y) => x - y);
}

const listPages = (nums) => (nums.length === 1 ? "page " + nums[0] : "pages " + nums.slice(0, -1).join(", ") + " and " + nums[nums.length - 1]);

function pdfProblem(err) {
  if (err instanceof PdfError) return err.message;
  return "it could not be read (" + (err?.message || String(err)) + ")";
}

function renderPage(pdf, index, maxDimension) {
  const img = extractPageImage(pdf, index);
  let dim = maxDimension;
  for (;;) {
    const small = orient(downscale(img, dim, { bilevel: img.bilevel }), img.orientation);
    const png = encodePngGray(small);
    if (png.length <= MAX_PNG_BYTES || dim <= 600) return { png, width: small.width, height: small.height };
    dim = Math.max(600, Math.round(dim * 0.75));
  }
}

async function getDrawings(args) {
  checkDocumentId(args.documentId);
  const requested = parsePages(args.pages);
  const maxDimension = clampInt(args.maxDimension, 1600, 600, 2400);
  const { appNo, lookup } = await resolveApplication(args);
  const list = await getJson(
    "/patent/applications/" + appNo + "/documents",
    "No application " + appNo + " was found at USPTO."
  );
  const docs = list.documentBag || [];
  const pdfOption = (d) => (d.downloadOptionBag || []).find((o) => o.mimeTypeIdentifier === "PDF" && o.downloadUrl);
  let doc;
  if (args.documentId) {
    doc = docs.find((d) => d.documentIdentifier === args.documentId);
    if (!doc) throw new UserError("Document " + args.documentId + " was not found in application " + appNo + ". Use get_patent_documents to list valid document IDs.");
  } else {
    doc = docs
      .filter((d) => DRAWING_CODES.includes(d.documentCode) && pdfOption(d))
      .sort((a, b) => String(b.officialDate).localeCompare(String(a.officialDate)) || DRAWING_CODES.indexOf(a.documentCode) - DRAWING_CODES.indexOf(b.documentCode))[0];
    if (!doc) throw new UserError("Application " + appNo + " has no drawings document (DRW) at USPTO. Some applications have no drawings; use get_patent_documents to see what exists.");
  }
  const opt = pdfOption(doc);
  if (!opt) throw new UserError("Document " + doc.documentIdentifier + " has no PDF download at USPTO, so it cannot be shown as images.");

  const res = await request(opt.downloadUrl, {}, "USPTO could not find the PDF for document " + doc.documentIdentifier + ".");
  const buf = await readLimited(res);
  let pdf;
  let total;
  try {
    pdf = new PdfDocument(buf);
    total = pdf.pages().length;
  } catch (err) {
    throw new UserError("Could not read the drawings PDF for document " + doc.documentIdentifier + ": " + pdfProblem(err) + ".");
  }
  if (!total) throw new UserError("The drawings PDF for document " + doc.documentIdentifier + " has no pages.");

  const pages = requested || Array.from({ length: Math.min(DEFAULT_DRAWING_PAGES, total) }, (_, i) => i + 1);
  const missing = pages.filter((p) => p > total);
  if (missing.length)
    throw new UserError(
      (missing.length === 1 ? "Page " + missing[0] + " does not exist" : "Pages " + missing.join(", ") + " do not exist") +
        ": document " + doc.documentIdentifier + " has " + total + (total === 1 ? " page." : " pages (1 to " + total + ").")
    );

  const images = [];
  const shown = [];
  const unreadable = [];
  for (const p of pages) {
    try {
      const r = renderPage(pdf, p - 1, maxDimension);
      images.push({ type: "image", data: r.png.toString("base64"), mimeType: "image/png" });
      shown.push({ page: p, width: r.width, height: r.height, pngBytes: r.png.length });
    } catch (err) {
      const reason = err instanceof UnsupportedImageError ? err.message : pdfProblem(err);
      unreadable.push({ page: p, problem: "Page " + p + " cannot be shown: " + reason + "." });
    }
  }

  const summary = withLookup(lookup, {
    applicationNumber: appNo,
    documentId: doc.documentIdentifier,
    code: doc.documentCode,
    description: doc.documentCodeDescriptionText,
    date: String(doc.officialDate || "").slice(0, 10),
    totalPages: total,
    pagesReturned: shown.map((s) => s.page),
    images: shown,
  });
  if (unreadable.length) summary.unreadablePages = unreadable;
  const notShown = [];
  for (let p = 1; p <= total; p++) if (!pages.includes(p)) notShown.push(p);
  if (notShown.length) {
    const next = notShown.filter((p) => p > Math.max(...pages)).slice(0, MAX_DRAWING_PAGES);
    summary.morePages = listPages(notShown) + " not shown." + (next.length ? " Call get_drawings again with pages '" + (next.length === 1 ? next[0] : next[0] + "-" + next[next.length - 1]) + "' to see more." : "");
  }
  summary.note = shown.length
    ? "The images below are the drawing sheets from the USPTO record for this application, as filed or as published, in page order and downscaled for viewing. If reference numerals are hard to read, ask again with a larger maxDimension (up to 2400)."
    : "None of the requested pages could be shown as images. The document can still be opened in Patent Center: https://patentcenter.uspto.gov/applications/" + appNo;
  return { [CONTENT]: [{ type: "text", text: JSON.stringify(summary, null, 2) }, ...images] };
}

const HANDLERS = {
  search_patents: searchPatents,
  get_patent: getPatent,
  get_patent_documents: getPatentDocuments,
  get_document_text: getDocumentText,
  get_drawings: getDrawings,
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
    if (data && data[CONTENT]) return { content: data[CONTENT] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    const message = err instanceof UserError ? err.message : "Unexpected error: " + (err?.message || String(err));
    return { content: [{ type: "text", text: "Error: " + message }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
