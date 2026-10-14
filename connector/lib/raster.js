// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
//
// Grayscale raster helpers for drawing sheets: area averaging downscale,
// quarter turn and mirror orientation, and a small PNG encoder built on
// Node's zlib. No native modules.

import zlib from "node:zlib";

// Precomputes, for each output position, which input positions it covers and
// how much of each (exact box coverage, so every input pixel contributes).
function boxWeights(inSize, outSize) {
  const scale = inSize / outSize;
  const starts = new Int32Array(outSize);
  const counts = new Int32Array(outSize);
  const weights = [];
  for (let o = 0; o < outSize; o++) {
    const a = o * scale;
    const b = Math.min(inSize, (o + 1) * scale);
    const first = Math.floor(a);
    const last = Math.min(inSize - 1, Math.ceil(b) - 1);
    starts[o] = weights.length;
    for (let i = first; i <= last; i++) {
      const cover = Math.min(b, i + 1) - Math.max(a, i);
      weights.push(i, cover / scale);
    }
    counts[o] = (weights.length - starts[o]) / 2;
  }
  return { starts, counts, w: Float64Array.from(weights) };
}

// Downscales 8 bit grayscale so the longer side is at most maxDimension,
// preserving the aspect ratio. Never enlarges. Area averaging keeps thin
// lines in 1 bit scans visible as gray instead of dropping them; for bilevel
// sources a mild gamma darkens those gray strokes so they stay legible.
export function downscale(img, maxDimension, { bilevel = false } = {}) {
  const { width, height, gray } = img;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));
  if (outW === width && outH === height) return { width, height, gray };
  const hx = boxWeights(width, outW);
  const hy = boxWeights(height, outH);
  const tmp = new Float32Array(outW * height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    const orow = y * outW;
    for (let x = 0; x < outW; x++) {
      let s = 0;
      const st = hx.starts[x];
      for (let k = 0; k < hx.counts[x]; k++) s += gray[row + hx.w[st + 2 * k]] * hx.w[st + 2 * k + 1];
      tmp[orow + x] = s;
    }
  }
  const out = new Uint8Array(outW * outH);
  const curve = new Uint8Array(256);
  for (let v = 0; v < 256; v++) curve[v] = bilevel ? Math.round(255 * Math.pow(v / 255, 1.8)) : v;
  for (let y = 0; y < outH; y++) {
    const st = hy.starts[y];
    const n = hy.counts[y];
    for (let x = 0; x < outW; x++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += tmp[hy.w[st + 2 * k] * outW + x] * hy.w[st + 2 * k + 1];
      out[y * outW + x] = curve[Math.max(0, Math.min(255, Math.round(s)))];
    }
  }
  return { width: outW, height: outH, gray: out };
}

// Applies { transpose, flipX, flipY } (see pdf.js displayOrientation).
// Transpose swaps rows and columns first; flips then mirror the result.
export function orient(img, o) {
  if (!o || (!o.transpose && !o.flipX && !o.flipY)) return img;
  const { width, height, gray } = img;
  const outW = o.transpose ? height : width;
  const outH = o.transpose ? width : height;
  const out = new Uint8Array(outW * outH);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let X = o.transpose ? y : x;
      let Y = o.transpose ? x : y;
      if (o.flipX) X = outW - 1 - X;
      if (o.flipY) Y = outH - 1 - Y;
      out[Y * outW + X] = gray[y * width + x];
    }
  }
  return { width: outW, height: outH, gray: out };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// Encodes 8 bit grayscale as PNG. When every pixel is pure black or pure
// white the image is stored at 1 bit per pixel; otherwise 8 bits. Each row
// gets the PNG filter with the smallest sum of absolute differences.
export function encodePngGray(img) {
  const { width, height, gray } = img;
  let bilevel = true;
  for (let i = 0; i < gray.length; i++) if (gray[i] !== 0 && gray[i] !== 255) { bilevel = false; break; }
  const depth = bilevel ? 1 : 8;
  const rowBytes = bilevel ? Math.ceil(width / 8) : width;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  let prev = Buffer.alloc(rowBytes);
  const cur = Buffer.alloc(rowBytes);
  const cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(rowBytes));
  for (let y = 0; y < height; y++) {
    cur.fill(0);
    const src = y * width;
    if (bilevel) {
      for (let x = 0; x < width; x++) if (gray[src + x]) cur[x >> 3] |= 0x80 >> (x & 7);
    } else {
      for (let x = 0; x < width; x++) cur[x] = gray[src + x];
    }
    const bpp = 1;
    let best = 0;
    let bestScore = Infinity;
    for (let f = 0; f < 5; f++) {
      const out = cand[f];
      let score = 0;
      for (let i = 0; i < rowBytes; i++) {
        const a = i >= bpp ? cur[i - bpp] : 0;
        const b = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        let p;
        if (f === 0) p = 0;
        else if (f === 1) p = a;
        else if (f === 2) p = b;
        else if (f === 3) p = (a + b) >> 1;
        else {
          const q = a + b - c;
          const pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
          p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        const v = (cur[i] - p) & 255;
        out[i] = v;
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) { bestScore = score; best = f; }
      if (score === 0) break;
    }
    const at = y * (rowBytes + 1);
    raw[at] = best;
    cand[best].copy(raw, at + 1);
    prev = Buffer.from(cur);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = depth;
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9, memLevel: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
