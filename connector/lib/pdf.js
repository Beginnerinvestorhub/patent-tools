// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
//
// Small, dependency free PDF reader for scanned drawing sheets.
//
// USPTO serves drawings (DRW documents) as PDFs in which every page holds one
// scanned image. This module reads just enough PDF to find each page's image
// and turn it into 8 bit grayscale pixels:
//   * classic cross reference tables and cross reference streams, object
//     streams, incremental updates (/Prev) and a full rescan of the file when
//     the cross reference data is damaged;
//   * the page tree in /Kids order, with inherited /Resources and /Rotate;
//   * image XObjects on the page (and inside form XObjects), placed with the
//     transformation matrix from the page content stream;
//   * FlateDecode (with PNG and TIFF predictors), LZWDecode, ASCIIHexDecode,
//     ASCII85Decode, RunLengthDecode and CCITTFaxDecode (fax Group 3 and 4,
//     the format of most USPTO drawing sheets; see ccitt.js);
//   * 1, 2, 4, 8 and 16 bit samples in DeviceGray, DeviceRGB, DeviceCMYK,
//     CalGray, CalRGB, ICCBased, Indexed and Separation color spaces, /Decode
//     arrays and /ImageMask.
// Images compressed with JBIG2Decode, DCTDecode or JPXDecode
// raise UnsupportedImageError so the caller can explain that page instead of
// failing the whole document.
//
// The input is untrusted. Every loop and allocation is bounded: decompressed
// size per image, page count, nesting and recursion depth, reference chains,
// cross reference chains and content stream length. Problems raise PdfError
// with a plain English message.

import zlib from "node:zlib";
import { decodeCCITT } from "./ccitt.js";

export class PdfError extends Error {}
export class UnsupportedImageError extends PdfError {
  constructor(filter) {
    super("this page's image is stored as " + filter + ", a format this tool cannot decode");
    this.filter = filter;
  }
}

export const LIMITS = {
  maxImageBytes: 50 * 1024 * 1024, // decompressed bytes per image
  maxStreamBytes: 16 * 1024 * 1024, // decompressed bytes per other stream
  maxImageSide: 20000, // pixels per side
  maxPages: 2000,
  maxDepth: 32, // page tree, form XObject and object nesting depth
  maxRefChain: 16,
  maxXrefSections: 32,
  maxOperators: 200000, // content stream operators examined per page
};

// ---------------------------------------------------------------------------
// Object model
// ---------------------------------------------------------------------------

export class Name {
  constructor(v) { this.v = v; }
}
export class Ref {
  constructor(num, gen) { this.num = num; this.gen = gen; }
}
class Keyword {
  constructor(v) { this.v = v; }
}
export class Stream {
  constructor(dict, start, buf) { this.dict = dict; this.start = start; this.buf = buf; }
}
const EOF = new Keyword("EOF");

const isName = (v, n) => v instanceof Name && (n === undefined || v.v === n);
const isDict = (v) => v !== null && typeof v === "object" && Object.getPrototypeOf(v) === null;

// ---------------------------------------------------------------------------
// Lexer and parser
// ---------------------------------------------------------------------------

const WS = new Uint8Array(256);
for (const c of [0, 9, 10, 12, 13, 32]) WS[c] = 1;
const DELIM = new Uint8Array(256);
for (const c of "()<>[]{}/%") DELIM[c.charCodeAt(0)] = 1;

class Lexer {
  constructor(buf, pos = 0, end = buf.length) {
    this.buf = buf;
    this.pos = pos;
    this.end = end;
  }

  skipSpace() {
    const b = this.buf;
    while (this.pos < this.end) {
      const c = b[this.pos];
      if (WS[c]) this.pos++;
      else if (c === 0x25) {
        while (this.pos < this.end && b[this.pos] !== 10 && b[this.pos] !== 13) this.pos++;
      } else break;
    }
  }

  // Returns the next token: a number, Name, Buffer (string), Keyword, or one
  // of the punctuation keywords "[", "]", "<<", ">>", "{", "}".
  token() {
    this.skipSpace();
    const b = this.buf;
    if (this.pos >= this.end) return EOF;
    const c = b[this.pos];
    if (c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d) {
      this.pos++;
      return new Keyword(String.fromCharCode(c));
    }
    if (c === 0x3c) {
      if (b[this.pos + 1] === 0x3c) { this.pos += 2; return new Keyword("<<"); }
      return this.hexString();
    }
    if (c === 0x3e) {
      if (b[this.pos + 1] === 0x3e) { this.pos += 2; return new Keyword(">>"); }
      this.pos++;
      return new Keyword(">");
    }
    if (c === 0x28) return this.literalString();
    if (c === 0x2f) return this.name();
    const start = this.pos;
    while (this.pos < this.end && !WS[b[this.pos]] && !DELIM[b[this.pos]]) this.pos++;
    if (this.pos === start) { this.pos++; return new Keyword(String.fromCharCode(c)); }
    const s = b.toString("latin1", start, this.pos);
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return Number(s);
    return new Keyword(s);
  }

  name() {
    const b = this.buf;
    this.pos++;
    const start = this.pos;
    while (this.pos < this.end && !WS[b[this.pos]] && !DELIM[b[this.pos]]) this.pos++;
    const raw = b.toString("latin1", start, this.pos);
    return new Name(raw.includes("#") ? raw.replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) : raw);
  }

  hexString() {
    const b = this.buf;
    this.pos++;
    const digits = [];
    while (this.pos < this.end && b[this.pos] !== 0x3e) {
      const ch = b[this.pos++];
      if (!WS[ch]) digits.push(ch);
    }
    this.pos++;
    let hex = Buffer.from(digits).toString("latin1").replace(/[^0-9a-fA-F]/g, "");
    if (hex.length % 2) hex += "0";
    return Buffer.from(hex, "hex");
  }

  literalString() {
    const b = this.buf;
    this.pos++;
    const out = [];
    let depth = 1;
    while (this.pos < this.end) {
      let ch = b[this.pos++];
      if (ch === 0x5c) {
        const n = b[this.pos++];
        const map = { 0x6e: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12 };
        if (map[n] !== undefined) out.push(map[n]);
        else if (n >= 0x30 && n <= 0x37) {
          let v = n - 0x30;
          for (let k = 0; k < 2 && b[this.pos] >= 0x30 && b[this.pos] <= 0x37; k++) v = v * 8 + (b[this.pos++] - 0x30);
          out.push(v & 255);
        } else if (n === 13) {
          if (b[this.pos] === 10) this.pos++;
        } else if (n !== 10) out.push(n);
        continue;
      }
      if (ch === 0x28) depth++;
      else if (ch === 0x29 && --depth === 0) break;
      out.push(ch);
    }
    return Buffer.from(out);
  }
}

// Parses one object. Integers followed by "gen R" become Ref.
function parseObject(lex, depth = 0) {
  if (depth > LIMITS.maxDepth * 2) throw new PdfError("the file nests objects too deeply");
  const t = lex.token();
  if (typeof t === "number") {
    if (Number.isInteger(t) && t >= 0) {
      const save = lex.pos;
      const g = lex.token();
      if (typeof g === "number" && Number.isInteger(g) && g >= 0) {
        const r = lex.token();
        if (r instanceof Keyword && r.v === "R") return new Ref(t, g);
      }
      lex.pos = save;
    }
    return t;
  }
  if (t instanceof Keyword) {
    if (t.v === "[") {
      const arr = [];
      for (;;) {
        const save = lex.pos;
        const n = lex.token();
        if (n instanceof Keyword && n.v === "]") break;
        if (n === EOF) throw new PdfError("an array is not closed");
        lex.pos = save;
        arr.push(parseObject(lex, depth + 1));
      }
      return arr;
    }
    if (t.v === "<<") {
      const dict = Object.create(null);
      for (;;) {
        const k = lex.token();
        if (k instanceof Keyword && k.v === ">>") break;
        if (k === EOF) throw new PdfError("a dictionary is not closed");
        if (!(k instanceof Name)) continue; // tolerate junk between entries
        const save = lex.pos;
        const v = lex.token();
        if (v instanceof Keyword && v.v === ">>") { dict[k.v] = null; break; }
        lex.pos = save;
        dict[k.v] = parseObject(lex, depth + 1);
      }
      return dict;
    }
    if (t.v === "true") return true;
    if (t.v === "false") return false;
    if (t.v === "null") return null;
  }
  return t;
}

// ---------------------------------------------------------------------------
// Stream filters
// ---------------------------------------------------------------------------

const UNSUPPORTED_IMAGE_FILTERS = {
  JBIG2Decode: "JBIG2Decode",
  DCTDecode: "DCTDecode (JPEG)",
  DCT: "DCTDecode (JPEG)",
  JPXDecode: "JPXDecode (JPEG 2000)",
};

function tooLarge(limit) {
  return new PdfError("a stream is larger than the " + Math.round(limit / 1048576) + " MB safety limit when decompressed");
}

function inflate(data, limit) {
  const opts = { maxOutputLength: limit, finishFlush: zlib.constants.Z_SYNC_FLUSH };
  const attempt = (fn) => {
    try {
      return fn(data, opts);
    } catch (err) {
      if (err?.code === "ERR_BUFFER_TOO_LARGE" || err instanceof RangeError) throw tooLarge(limit);
      return null;
    }
  };
  const out = attempt(zlib.inflateSync) ?? attempt(zlib.inflateRawSync);
  if (!out) throw new PdfError("a compressed stream is damaged");
  return out;
}

function lzwDecode(data, earlyChange, limit) {
  const out = [];
  let total = 0;
  const dict = [];
  const reset = () => {
    dict.length = 0;
    for (let i = 0; i < 256; i++) dict.push([i]);
    dict.push(null, null);
  };
  reset();
  let codeLen = 9;
  let bitBuf = 0;
  let bitCount = 0;
  let prev = null;
  for (let i = 0; i < data.length; i++) {
    bitBuf = (bitBuf << 8) | data[i];
    bitCount += 8;
    while (bitCount >= codeLen) {
      const code = (bitBuf >>> (bitCount - codeLen)) & ((1 << codeLen) - 1);
      bitCount -= codeLen;
      bitBuf &= (1 << bitCount) - 1;
      if (code === 256) { reset(); codeLen = 9; prev = null; continue; }
      if (code === 257) return Buffer.concat(out);
      let entry;
      if (code < dict.length && dict[code]) entry = dict[code];
      else if (code === dict.length && prev) entry = prev.concat(prev[0]);
      else throw new PdfError("an LZW compressed stream is damaged");
      const chunk = Buffer.from(entry);
      total += chunk.length;
      if (total > limit) throw tooLarge(limit);
      out.push(chunk);
      if (prev) {
        if (dict.length < 4096) dict.push(prev.concat(entry[0]));
      }
      prev = entry;
      const size = dict.length + earlyChange;
      if (size >= 2048) codeLen = 12;
      else if (size >= 1024) codeLen = 11;
      else if (size >= 512) codeLen = 10;
    }
  }
  return Buffer.concat(out);
}

function asciiHexDecode(data) {
  let s = data.toString("latin1");
  const gt = s.indexOf(">");
  if (gt >= 0) s = s.slice(0, gt);
  s = s.replace(/[^0-9a-fA-F]/g, "");
  if (s.length % 2) s += "0";
  return Buffer.from(s, "hex");
}

function ascii85Decode(data, limit) {
  const s = data.toString("latin1").replace(/^\s*<~/, "");
  const out = [];
  let group = [];
  for (const ch of s) {
    if (ch === "~") break;
    if (/\s/.test(ch)) continue;
    if (ch === "z" && group.length === 0) { out.push(0, 0, 0, 0); continue; }
    const v = ch.charCodeAt(0) - 33;
    if (v < 0 || v > 84) throw new PdfError("an ASCII85 stream is damaged");
    group.push(v);
    if (group.length === 5) {
      let n = 0;
      for (const g of group) n = n * 85 + g;
      out.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
      group = [];
      if (out.length > limit) throw tooLarge(limit);
    }
  }
  if (group.length > 1) {
    const k = group.length;
    while (group.length < 5) group.push(84);
    let n = 0;
    for (const g of group) n = n * 85 + g;
    const bytes = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    out.push(...bytes.slice(0, k - 1));
  }
  return Buffer.from(out);
}

function runLengthDecode(data, limit) {
  const out = [];
  let total = 0;
  for (let i = 0; i < data.length; ) {
    const n = data[i++];
    if (n === 128) break;
    if (n < 128) {
      const chunk = data.subarray(i, i + n + 1);
      out.push(chunk);
      total += chunk.length;
      i += n + 1;
    } else {
      out.push(Buffer.alloc(257 - n, data[i++]));
      total += 257 - n;
    }
    if (total > limit) throw tooLarge(limit);
  }
  return Buffer.concat(out);
}

function unpredict(data, parms) {
  const predictor = Number(parms?.Predictor ?? 1);
  if (predictor <= 1) return data;
  const colors = Number(parms.Colors ?? 1);
  const bpc = Number(parms.BitsPerComponent ?? 8);
  const columns = Number(parms.Columns ?? 1);
  if (!(colors >= 1 && colors <= 32 && [1, 2, 4, 8, 16].includes(bpc) && columns >= 1 && columns <= 1e6))
    throw new PdfError("a stream has invalid predictor settings");
  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8));
  const rowBytes = Math.ceil((colors * bpc * columns) / 8);
  if (predictor === 2) {
    if (bpc !== 8) throw new PdfError("TIFF predictor with " + bpc + " bit samples is not supported");
    const out = Buffer.from(data);
    for (let r = 0; r + rowBytes <= out.length; r += rowBytes)
      for (let i = bpp; i < rowBytes; i++) out[r + i] = (out[r + i] + out[r + i - bpp]) & 255;
    return out;
  }
  // PNG predictors (10 to 15): every row starts with its own filter type byte.
  const rows = Math.floor(data.length / (rowBytes + 1));
  const out = Buffer.alloc(rows * rowBytes);
  let prevRow = Buffer.alloc(rowBytes);
  for (let r = 0; r < rows; r++) {
    const src = r * (rowBytes + 1);
    const type = data[src];
    const row = out.subarray(r * rowBytes, (r + 1) * rowBytes);
    for (let i = 0; i < rowBytes; i++) {
      const x = data[src + 1 + i];
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prevRow[i];
      const c = i >= bpp ? prevRow[i - bpp] : 0;
      let v;
      switch (type) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new PdfError("a stream uses an unknown PNG predictor row type");
      }
      row[i] = v & 255;
    }
    prevRow = row;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export class PdfDocument {
  constructor(buf) {
    if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
    this.buf = buf;
    const head = buf.toString("latin1", 0, Math.min(buf.length, 1024));
    this.headerOffset = head.indexOf("%PDF-");
    if (this.headerOffset < 0) throw new PdfError("the file is not a PDF");
    this.xref = new Map(); // num -> { type: 1, offset } | { type: 2, stream, index }
    this.cache = new Map();
    this.objStmCache = new Map();
    this.resolving = new Set();
    this.trailer = Object.create(null);
    let ok = false;
    try {
      this.readXrefChain();
      ok = isDict(this.resolve(this.trailer.Root));
    } catch {
      ok = false;
    }
    if (!ok) this.rebuildXref();
    if (this.trailer.Encrypt) throw new PdfError("the PDF is encrypted");
    this.root = this.resolve(this.trailer.Root);
    if (!isDict(this.root)) throw new PdfError("the PDF has no document catalog");
  }

  // ---- cross reference data ------------------------------------------------

  readXrefChain() {
    const tail = this.buf.toString("latin1", Math.max(0, this.buf.length - 2048));
    const m = /startxref\s+(\d+)/g;
    let last = null;
    for (let x; (x = m.exec(tail)); ) last = x;
    if (!last) throw new PdfError("no startxref");
    let offset = Number(last[1]) + 0;
    const seen = new Set();
    for (let n = 0; offset !== undefined && offset !== null; n++) {
      if (n >= LIMITS.maxXrefSections || seen.has(offset)) break;
      seen.add(offset);
      const at = this.fixOffset(offset);
      const trailer = this.buf.toString("latin1", at, at + 4) === "xref" ? this.readXrefTable(at) : this.readXrefStream(at);
      for (const k of Object.keys(trailer)) if (!(k in this.trailer)) this.trailer[k] = trailer[k];
      if (typeof trailer.XRefStm === "number") {
        try { this.readXrefStream(this.fixOffset(trailer.XRefStm)); } catch { /* hybrid file: table entries remain */ }
      }
      offset = typeof trailer.Prev === "number" ? trailer.Prev : null;
    }
  }

  // Some writers count offsets from the start of the file, others from the
  // %PDF header when junk precedes it.
  fixOffset(offset) {
    const looksRight = (o) => {
      const s = this.buf.toString("latin1", o, o + 24);
      return /^\s*(xref|\d+\s+\d+\s+obj)/.test(s);
    };
    if (looksRight(offset)) return offset;
    if (this.headerOffset > 0 && looksRight(offset + this.headerOffset)) return offset + this.headerOffset;
    throw new PdfError("bad cross reference offset");
  }

  readXrefTable(at) {
    const lex = new Lexer(this.buf, at + 4);
    for (;;) {
      const save = lex.pos;
      const first = lex.token();
      if (first instanceof Keyword && first.v === "trailer") break;
      if (typeof first !== "number") { lex.pos = save; throw new PdfError("bad cross reference table"); }
      const count = lex.token();
      if (typeof count !== "number" || count < 0 || count > 10_000_000) throw new PdfError("bad cross reference table");
      for (let i = 0; i < count; i++) {
        const off = lex.token();
        const gen = lex.token();
        const kind = lex.token();
        if (typeof off !== "number" || typeof gen !== "number" || !(kind instanceof Keyword))
          throw new PdfError("bad cross reference entry");
        const num = first + i;
        if (kind.v === "n" && !this.xref.has(num) && off > 0) this.xref.set(num, { type: 1, offset: off });
        else if (!this.xref.has(num)) this.xref.set(num, { type: 0 });
      }
    }
    const trailer = parseObject(lex);
    if (!isDict(trailer)) throw new PdfError("bad trailer");
    return trailer;
  }

  readXrefStream(at) {
    const obj = this.parseIndirectAt(at);
    if (!(obj instanceof Stream) || !isName(obj.dict.Type, "XRef")) throw new PdfError("bad cross reference stream");
    const d = obj.dict;
    const w = Array.isArray(d.W) ? d.W.map(Number) : null;
    if (!w || w.length < 3 || w.some((x) => !(x >= 0 && x <= 8))) throw new PdfError("bad cross reference stream widths");
    const size = Number(d.Size);
    const index = Array.isArray(d.Index) ? d.Index.map(Number) : [0, size];
    const data = this.decodeStream(obj, LIMITS.maxStreamBytes);
    const entryLen = w[0] + w[1] + w[2];
    let p = 0;
    const field = (len, def) => {
      if (len === 0) return def;
      let v = 0;
      for (let i = 0; i < len; i++) v = v * 256 + data[p++];
      return v;
    };
    for (let s = 0; s + 1 < index.length; s += 2) {
      const first = index[s];
      const count = index[s + 1];
      for (let i = 0; i < count && p + entryLen <= data.length; i++) {
        const type = field(w[0], 1);
        const f2 = field(w[1], 0);
        const f3 = field(w[2], 0);
        const num = first + i;
        if (this.xref.has(num)) continue;
        if (type === 1) this.xref.set(num, { type: 1, offset: f2 });
        else if (type === 2) this.xref.set(num, { type: 2, stream: f2, index: f3 });
        else this.xref.set(num, { type: 0 });
      }
    }
    return d;
  }

  // Damaged or missing cross reference data: find every "N G obj" in the file.
  rebuildXref() {
    this.xref = new Map();
    this.cache = new Map();
    this.objStmCache = new Map();
    const text = this.buf.toString("latin1");
    const re = /(\d+)\s+(\d+)\s+obj\b/g;
    for (let m; (m = re.exec(text)); ) {
      const prev = m.index > 0 ? text.charCodeAt(m.index - 1) : 32;
      if (prev >= 48 && prev <= 57) continue;
      this.xref.set(Number(m[1]), { type: 1, offset: m.index });
    }
    const trailer = Object.create(null);
    const tr = /trailer\s*<</g;
    for (let m; (m = tr.exec(text)); ) {
      try {
        const t = parseObject(new Lexer(this.buf, m.index + 7));
        if (isDict(t)) Object.assign(trailer, t);
      } catch { /* ignore a broken trailer */ }
    }
    // Objects packed inside object streams.
    for (const num of [...this.xref.keys()]) {
      let obj;
      try { obj = this.getObject(num); } catch { continue; }
      if (obj instanceof Stream && isName(obj.dict.Type, "ObjStm")) {
        try {
          const { nums } = this.loadObjStm(num);
          nums.forEach((n, i) => { if (!this.xref.has(n)) this.xref.set(n, { type: 2, stream: num, index: i }); });
        } catch { /* skip a broken object stream */ }
      }
      if (obj instanceof Stream && isName(obj.dict.Type, "XRef") && !trailer.Root) Object.assign(trailer, obj.dict);
    }
    if (!trailer.Root) {
      for (const num of this.xref.keys()) {
        let obj;
        try { obj = this.getObject(num); } catch { continue; }
        if (isDict(obj) && isName(obj.Type, "Catalog")) { trailer.Root = new Ref(num, 0); break; }
      }
    }
    delete trailer.Prev;
    this.trailer = trailer;
  }

  // ---- objects ---------------------------------------------------------------

  parseIndirectAt(offset) {
    const lex = new Lexer(this.buf, offset);
    const num = lex.token();
    const gen = lex.token();
    const kw = lex.token();
    if (typeof num !== "number" || typeof gen !== "number" || !(kw instanceof Keyword) || kw.v !== "obj")
      throw new PdfError("an object is missing where the cross reference points");
    const obj = parseObject(lex);
    if (isDict(obj)) {
      const save = lex.pos;
      const t = lex.token();
      if (t instanceof Keyword && t.v === "stream") {
        let p = lex.pos;
        // The keyword is followed by CRLF, LF or (in some writers) a bare CR.
        if (this.buf[p] === 13) p++;
        if (this.buf[p] === 10) p++;
        return new Stream(obj, p, this.buf);
      }
      lex.pos = save;
    }
    return obj;
  }

  getObject(num) {
    if (this.cache.has(num)) return this.cache.get(num);
    const e = this.xref.get(num);
    let obj = null;
    if (e?.type === 1) {
      obj = this.parseIndirectAt(this.fixOffset(e.offset));
    } else if (e?.type === 2) {
      const { nums, offsets, data, first } = this.loadObjStm(e.stream);
      const i = e.index < nums.length && nums[e.index] === num ? e.index : nums.indexOf(num);
      if (i >= 0) obj = parseObject(new Lexer(data, first + offsets[i]));
    }
    this.cache.set(num, obj);
    return obj;
  }

  loadObjStm(num) {
    if (this.objStmCache.has(num)) return this.objStmCache.get(num);
    if (this.resolving.has("objstm" + num)) throw new PdfError("object streams refer to each other in a loop");
    this.resolving.add("objstm" + num);
    try {
      const stm = this.getObject(num);
      if (!(stm instanceof Stream)) throw new PdfError("an object stream is missing");
      const n = Number(this.resolve(stm.dict.N));
      const first = Number(this.resolve(stm.dict.First));
      if (!(n >= 0 && n <= 1_000_000 && first >= 0)) throw new PdfError("an object stream header is invalid");
      const data = this.decodeStream(stm, LIMITS.maxStreamBytes);
      const lex = new Lexer(data, 0, Math.min(first, data.length));
      const nums = [];
      const offsets = [];
      for (let i = 0; i < n; i++) {
        const a = lex.token();
        const b = lex.token();
        if (typeof a !== "number" || typeof b !== "number") break;
        nums.push(a);
        offsets.push(b);
      }
      const out = { nums, offsets, data, first };
      this.objStmCache.set(num, out);
      return out;
    } finally {
      this.resolving.delete("objstm" + num);
    }
  }

  resolve(v) {
    for (let i = 0; v instanceof Ref; i++) {
      if (i >= LIMITS.maxRefChain) throw new PdfError("references point to each other in a loop");
      v = this.getObject(v.num);
    }
    return v;
  }

  // ---- streams ---------------------------------------------------------------

  rawStreamBytes(stream) {
    const buf = stream.buf;
    let len = this.resolve(stream.dict.Length);
    const start = stream.start;
    const valid = (l) => {
      if (!(Number.isInteger(l) && l >= 0 && start + l <= buf.length)) return false;
      const after = buf.toString("latin1", start + l, Math.min(buf.length, start + l + 32));
      return /^\s*endstream/.test(after);
    };
    if (!valid(len)) {
      const end = buf.indexOf("endstream", start, "latin1");
      if (end < 0) throw new PdfError("a stream has no end");
      len = end - start;
      while (len > 0 && (buf[start + len - 1] === 10 || buf[start + len - 1] === 13)) len--;
    }
    return buf.subarray(start, start + len);
  }

  filters(stream) {
    const f = this.resolve(stream.dict.Filter ?? stream.dict.F);
    const p = this.resolve(stream.dict.DecodeParms ?? stream.dict.DP);
    const names = (Array.isArray(f) ? f : f ? [f] : []).map((x) => this.resolve(x)).map((x) => (x instanceof Name ? x.v : String(x)));
    const parms = names.map((_, i) => {
      const v = Array.isArray(p) ? this.resolve(p[i]) : p;
      return isDict(v) ? v : null;
    });
    return { names, parms };
  }

  decodeStream(stream, limit) {
    let data = this.rawStreamBytes(stream);
    const { names, parms } = this.filters(stream);
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const parm = parms[i] ? Object.fromEntries(Object.entries(parms[i]).map(([k, v]) => [k, this.resolve(v)])) : null;
      switch (name) {
        case "FlateDecode":
        case "Fl":
          data = unpredict(inflate(data, limit), parm);
          break;
        case "LZWDecode":
        case "LZW":
          data = unpredict(lzwDecode(data, Number(parm?.EarlyChange ?? 1), limit), parm);
          break;
        case "ASCIIHexDecode":
        case "AHx":
          data = asciiHexDecode(data);
          break;
        case "ASCII85Decode":
        case "A85":
          data = ascii85Decode(data, limit);
          break;
        case "RunLengthDecode":
        case "RL":
          data = runLengthDecode(data, limit);
          break;
        case "CCITTFaxDecode":
        case "CCF":
          try {
            data = decodeCCITT(data, parm, limit, () => tooLarge(limit));
          } catch (e) {
            if (e instanceof PdfError) throw e;
            throw new PdfError("a fax compressed (CCITT) image is damaged: " + e.message);
          }
          break;
        default:
          if (UNSUPPORTED_IMAGE_FILTERS[name]) throw new UnsupportedImageError(UNSUPPORTED_IMAGE_FILTERS[name]);
          throw new UnsupportedImageError(name);
      }
      if (data.length > limit) throw tooLarge(limit);
    }
    return data;
  }

  // ---- pages -----------------------------------------------------------------

  pages() {
    if (this._pages) return this._pages;
    const out = [];
    const visited = new Set();
    const walk = (nodeRef, inherited, depth) => {
      if (depth > LIMITS.maxDepth) throw new PdfError("the page tree is nested too deeply");
      if (nodeRef instanceof Ref) {
        if (visited.has(nodeRef.num)) return;
        visited.add(nodeRef.num);
      }
      const node = this.resolve(nodeRef);
      if (!isDict(node)) return;
      const inh = {
        Resources: node.Resources ?? inherited.Resources,
        Rotate: node.Rotate ?? inherited.Rotate,
        MediaBox: node.MediaBox ?? inherited.MediaBox,
      };
      const kids = this.resolve(node.Kids);
      if (isName(node.Type, "Pages") || (Array.isArray(kids) && !isName(node.Type, "Page"))) {
        for (const kid of Array.isArray(kids) ? kids : []) {
          walk(kid, inh, depth + 1);
          if (out.length > LIMITS.maxPages) throw new PdfError("the PDF has more than " + LIMITS.maxPages + " pages");
        }
      } else {
        out.push({ dict: node, ...inh });
      }
    };
    walk(this.root.Pages, {}, 0);
    this._pages = out;
    return out;
  }

  // Collects image XObjects reachable from a resources dictionary, with the
  // transformation matrix each one is drawn with when the content stream
  // says so.
  pageImages(page) {
    const images = [];
    const visit = (resources, contents, baseCtm, depth) => {
      if (depth > 4) return;
      const res = this.resolve(resources);
      const xobjs = isDict(res) ? this.resolve(res.XObject) : null;
      if (!isDict(xobjs)) return;
      const placements = this.contentPlacements(contents, baseCtm);
      for (const [name, ref] of Object.entries(xobjs)) {
        const x = this.resolve(ref);
        if (!(x instanceof Stream)) continue;
        const sub = this.resolve(x.dict.Subtype);
        const ctm = placements.get(name);
        if (isName(sub, "Image")) {
          images.push({ name, stream: x, ctm: ctm || null });
        } else if (isName(sub, "Form")) {
          const m = this.resolve(x.dict.Matrix);
          const fm = Array.isArray(m) && m.length === 6 ? m.map(Number) : [1, 0, 0, 1, 0, 0];
          visit(x.dict.Resources, x, mul(fm, ctm || baseCtm), depth + 1);
        }
      }
    };
    visit(page.Resources, page.dict.Contents, [1, 0, 0, 1, 0, 0], 0);
    return images;
  }

  contentBytes(contents) {
    const c = contents instanceof Stream ? contents : this.resolve(contents);
    const parts = Array.isArray(c) ? c.map((x) => this.resolve(x)) : [c];
    const out = [];
    let total = 0;
    for (const s of parts) {
      if (!(s instanceof Stream)) continue;
      let d;
      try { d = this.decodeStream(s, LIMITS.maxStreamBytes); } catch { continue; }
      total += d.length + 1;
      if (total > LIMITS.maxStreamBytes) break;
      out.push(d, Buffer.from("\n"));
    }
    return Buffer.concat(out);
  }

  // Runs the content stream just far enough to know the matrix in effect at
  // each "/Name Do".
  contentPlacements(contents, baseCtm) {
    const placements = new Map();
    let data;
    try { data = this.contentBytes(contents); } catch { return placements; }
    const lex = new Lexer(data);
    let ctm = baseCtm;
    const stack = [];
    const operands = [];
    for (let ops = 0; ops < LIMITS.maxOperators; ) {
      const t = lex.token();
      if (t === EOF) break;
      if (t instanceof Keyword && !"[]<<>>{}".includes(t.v)) {
        ops++;
        if (t.v === "q") { if (stack.length < 64) stack.push(ctm); }
        else if (t.v === "Q") ctm = stack.pop() || baseCtm;
        else if (t.v === "cm" && operands.length >= 6) {
          const m = operands.slice(-6).map(Number);
          if (m.every(Number.isFinite)) ctm = mul(m, ctm);
        } else if (t.v === "Do" && operands.length && operands[operands.length - 1] instanceof Name) {
          const name = operands[operands.length - 1].v;
          if (!placements.has(name)) placements.set(name, ctm);
        } else if (t.v === "BI") {
          // Skip inline image data up to EI.
          const end = data.indexOf("EI", lex.pos, "latin1");
          lex.pos = end < 0 ? data.length : end + 2;
        }
        operands.length = 0;
      } else if (t instanceof Keyword) {
        operands.length = 0; // ignore arrays and dictionaries in operands
      } else {
        if (operands.length < 32) operands.push(t);
      }
    }
    return placements;
  }
}

// a then b (PDF row vector convention: [x y 1] * a * b)
function mul(a, b) {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

// ---------------------------------------------------------------------------
// Image decoding
// ---------------------------------------------------------------------------

function colorSpaceInfo(doc, cs, depth = 0) {
  cs = doc.resolve(cs);
  if (depth > 4) throw new PdfError("a color space is nested too deeply");
  if (cs instanceof Name) {
    switch (cs.v) {
      case "DeviceGray": case "G": case "CalGray": return { kind: "gray", n: 1 };
      case "DeviceRGB": case "RGB": case "CalRGB": return { kind: "rgb", n: 3 };
      case "DeviceCMYK": case "CMYK": return { kind: "cmyk", n: 4 };
      default: throw new UnsupportedImageError("the " + cs.v + " color space");
    }
  }
  if (Array.isArray(cs) && cs.length) {
    const family = doc.resolve(cs[0]);
    const fam = family instanceof Name ? family.v : "";
    if (fam === "CalGray") return { kind: "gray", n: 1 };
    if (fam === "CalRGB") return { kind: "rgb", n: 3 };
    if (fam === "ICCBased") {
      const s = doc.resolve(cs[1]);
      const n = s instanceof Stream ? Number(doc.resolve(s.dict.N)) : 0;
      if (n === 1) return { kind: "gray", n: 1 };
      if (n === 3) return { kind: "rgb", n: 3 };
      if (n === 4) return { kind: "cmyk", n: 4 };
      if (s instanceof Stream && s.dict.Alternate) return colorSpaceInfo(doc, s.dict.Alternate, depth + 1);
      throw new UnsupportedImageError("an ICC color profile with " + n + " components");
    }
    if (fam === "Indexed" || fam === "I") {
      const base = colorSpaceInfo(doc, cs[1], depth + 1);
      const hival = Math.max(0, Math.min(255, Number(doc.resolve(cs[2])) | 0));
      let lookup = doc.resolve(cs[3]);
      if (lookup instanceof Stream) lookup = doc.decodeStream(lookup, 4096 * 4);
      if (!Buffer.isBuffer(lookup)) throw new PdfError("an indexed color table is missing");
      const table = new Uint8Array(256).fill(255);
      for (let i = 0; i <= hival; i++) table[i] = toGray(base.kind, lookup, i * base.n);
      return { kind: "indexed", n: 1, table, hival };
    }
    if (fam === "Separation" || fam === "DeviceN") {
      const n = fam === "Separation" ? 1 : Array.isArray(doc.resolve(cs[1])) ? doc.resolve(cs[1]).length : 1;
      return { kind: "tint", n };
    }
    if (fam === "DeviceGray" || fam === "DeviceRGB" || fam === "DeviceCMYK") return colorSpaceInfo(doc, family, depth + 1);
    throw new UnsupportedImageError("the " + (fam || "unknown") + " color space");
  }
  return { kind: "gray", n: 1 };
}

function toGray(kind, src, i) {
  if (kind === "gray") return src[i];
  if (kind === "rgb") return Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
  if (kind === "cmyk") {
    const k = 1 - src[i + 3] / 255;
    const r = (1 - src[i] / 255) * k, g = (1 - src[i + 1] / 255) * k, b = (1 - src[i + 2] / 255) * k;
    return Math.round(255 * (0.299 * r + 0.587 * g + 0.114 * b));
  }
  return 255 - src[i];
}

// Decodes an image XObject into 8 bit grayscale (0 black, 255 white).
export function decodeImage(doc, stream) {
  const d = stream.dict;
  const width = Number(doc.resolve(d.Width ?? d.W));
  const height = Number(doc.resolve(d.Height ?? d.H));
  if (!(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0))
    throw new PdfError("an image has no valid size");
  if (width > LIMITS.maxImageSide || height > LIMITS.maxImageSide)
    throw new PdfError("an image is larger than " + LIMITS.maxImageSide + " pixels on a side");
  const imageMask = doc.resolve(d.ImageMask ?? d.IM) === true;
  const bpc = imageMask ? 1 : Number(doc.resolve(d.BitsPerComponent ?? d.BPC) ?? 8);
  if (![1, 2, 4, 8, 16].includes(bpc)) throw new PdfError("an image has an unsupported bit depth (" + bpc + ")");
  const cs = imageMask ? { kind: "gray", n: 1 } : colorSpaceInfo(doc, d.ColorSpace ?? d.CS ?? new Name("DeviceGray"));
  const n = cs.n;
  const rowBytes = Math.ceil((width * n * bpc) / 8);
  const needed = rowBytes * height;
  if (needed > LIMITS.maxImageBytes || width * height > LIMITS.maxImageBytes)
    throw new PdfError("an image is larger than the 50 MB safety limit when decompressed");

  const data = doc.decodeStream(stream, LIMITS.maxImageBytes);

  // /Decode maps each raw sample linearly; [1 0] inverts.
  const maxv = (1 << bpc) - 1;
  let decode = doc.resolve(d.Decode ?? d.D);
  decode = Array.isArray(decode) ? decode.map((x) => Number(doc.resolve(x))) : null;
  const ranges = [];
  for (let c = 0; c < n; c++) {
    let lo = 0;
    let hi = cs.kind === "indexed" ? maxv : 1;
    if (decode && decode.length >= 2 * (c + 1) && Number.isFinite(decode[2 * c]) && Number.isFinite(decode[2 * c + 1])) {
      lo = decode[2 * c];
      hi = decode[2 * c + 1];
    }
    ranges.push([lo, hi]);
  }
  const gray = new Uint8Array(width * height);

  if (n === 1 && bpc === 1 && (cs.kind === "gray" || imageMask)) {
    // Fast path for bilevel scans, the common USPTO case.
    let zero = ranges[0][0] >= 0.5 ? 255 : 0;
    let one = ranges[0][1] >= 0.5 ? 255 : 0;
    if (imageMask) {
      // Mask sample 0 paints (black) by default; /Decode [1 0] flips that.
      const flip = ranges[0][0] === 1;
      zero = flip ? 255 : 0;
      one = flip ? 0 : 255;
    }
    for (let y = 0; y < height; y++) {
      const rowStart = y * rowBytes;
      const out = y * width;
      for (let x = 0; x < width; x++) {
        const byte = data[rowStart + (x >> 3)] ?? 0;
        gray[out + x] = (byte >> (7 - (x & 7))) & 1 ? one : zero;
      }
    }
    return { width, height, gray, bilevel: true };
  }

  const sample = (row, idx) => {
    if (bpc === 8) return data[row + idx] ?? 0;
    if (bpc === 16) return ((data[row + idx * 2] ?? 0) << 8) | (data[row + idx * 2 + 1] ?? 0);
    const bit = idx * bpc;
    const byte = data[row + (bit >> 3)] ?? 0;
    return (byte >> (8 - bpc - (bit & 7))) & maxv;
  };
  const px = new Uint8Array(Math.max(n, 4));
  for (let y = 0; y < height; y++) {
    const row = y * rowBytes;
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < n; c++) {
        const s = sample(row, x * n + c);
        const [lo, hi] = ranges[c];
        const v = lo + (s * (hi - lo)) / maxv;
        px[c] = cs.kind === "indexed" ? Math.max(0, Math.min(255, Math.round(v))) : Math.max(0, Math.min(255, Math.round(v * 255)));
      }
      let g;
      if (cs.kind === "indexed") g = cs.table[px[0]];
      else if (cs.kind === "tint") g = 255 - px[0];
      else g = toGray(cs.kind, px, 0);
      gray[y * width + x] = g;
    }
  }
  return { width, height, gray, bilevel: false };
}

// Works out how a decoded image must be turned so it reads the way the page
// displays: the image placement matrix plus the page /Rotate.
export function displayOrientation(ctm, rotate) {
  const m = ctm || [1, 0, 0, 1, 0, 0];
  let col = [m[0], m[1]]; // direction of increasing image column
  let row = [-m[2], -m[3]]; // direction of increasing image row (rows run top down)
  const r = ((((Number(rotate) || 0) % 360) + 360) % 360);
  const rot = (v) => {
    const rad = (r * Math.PI) / 180;
    const cos = Math.round(Math.cos(rad)), sin = Math.round(Math.sin(rad));
    return [v[0] * cos + v[1] * sin, -v[0] * sin + v[1] * cos];
  };
  if (r % 90 === 0) { col = rot(col); row = rot(row); }
  // Screen coordinates run downward.
  col = [col[0], -col[1]];
  row = [row[0], -row[1]];
  const axis = (v) => (Math.abs(v[0]) >= Math.abs(v[1]) ? { axis: "x", sign: v[0] < 0 ? -1 : 1 } : { axis: "y", sign: v[1] < 0 ? -1 : 1 });
  const c = axis(col);
  const w = axis(row);
  if (c.axis === w.axis) return { transpose: false, flipX: false, flipY: false };
  if (c.axis === "x") return { transpose: false, flipX: c.sign < 0, flipY: w.sign < 0 };
  return { transpose: true, flipX: w.sign < 0, flipY: c.sign < 0 };
}

// Returns { width, height, gray, bilevel, orientation } for one page (0 based),
// choosing the largest image drawn on the page.
export function extractPageImage(doc, pageIndex) {
  const page = doc.pages()[pageIndex];
  if (!page) throw new PdfError("page " + (pageIndex + 1) + " does not exist");
  const images = doc.pageImages(page);
  if (!images.length) throw new UnsupportedImageError("vector graphics or text with no scanned image");
  const placed = images.filter((i) => i.ctm);
  const pool = placed.length ? placed : images;
  const area = (i) => Number(doc.resolve(i.stream.dict.Width)) * Number(doc.resolve(i.stream.dict.Height)) || 0;
  const best = pool.reduce((a, b) => (area(b) > area(a) ? b : a));
  const img = decodeImage(doc, best.stream);
  img.orientation = displayOrientation(best.ctm, doc.resolve(page.Rotate));
  img.imageCount = images.length;
  return img;
}
