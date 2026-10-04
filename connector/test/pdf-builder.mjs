// Copyright 2026 Kevin Ringler
// SPDX-License-Identifier: Apache-2.0
// Test only: writes tiny PDFs with one image per page, either with a classic
// cross reference table or with a cross reference stream plus an object
// stream, so the PDF reader can be exercised on structures the USPTO sample
// does not use.
import zlib from "node:zlib";

// pages: [{ image: { width, height, dict: "extra dictionary entries", data: Buffer },
//           rotate?: number, content?: string }]
// options.mode: "table" (default) or "xrefstream" (page objects go in an object stream)
// options.badStartxref: write a wrong startxref offset (forces a rebuild)
export function buildImagePdf(pages, { mode = "table", badStartxref = false } = {}) {
  const objs = new Map(); // num -> { body: string, stream?: Buffer }
  let next = 3;
  const kids = [];
  for (const p of pages) {
    const pageNum = next++;
    const contentNum = next++;
    const imageNum = next++;
    const content = Buffer.from(p.content ?? `q ${p.width ?? 612} 0 0 ${p.height ?? 792} 0 0 cm /Im0 Do Q`);
    objs.set(contentNum, { body: `<< /Length ${content.length} >>`, stream: content });
    const img = p.image;
    objs.set(imageNum, {
      body: `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} ${img.dict} /Length ${img.data.length} >>`,
      stream: img.data,
    });
    objs.set(pageNum, {
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.width ?? 612} ${p.height ?? 792}] ${p.rotate ? "/Rotate " + p.rotate : ""} /Resources << /XObject << /Im0 ${imageNum} 0 R >> >> /Contents ${contentNum} 0 R >>`,
    });
    kids.push(pageNum);
  }
  objs.set(1, { body: "<< /Type /Catalog /Pages 2 0 R >>" });
  objs.set(2, { body: `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((k) => k + " 0 R").join(" ")}] >>` });

  const parts = [Buffer.from("%PDF-1.5\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  let pos = parts[0].length;
  const offsets = new Map();
  const write = (b) => { parts.push(b); pos += b.length; };
  const writeObj = (num, body, stream) => {
    offsets.set(num, pos);
    write(Buffer.from(`${num} 0 obj\n${body}\n`, "latin1"));
    if (stream) {
      write(Buffer.from("stream\r\n", "latin1"));
      write(stream);
      write(Buffer.from("\nendstream\n", "latin1"));
    }
    write(Buffer.from("endobj\n", "latin1"));
  };

  if (mode === "table") {
    for (const [num, o] of [...objs].sort((a, b) => a[0] - b[0])) writeObj(num, o.body, o.stream);
    const size = Math.max(...objs.keys()) + 1;
    const xrefAt = pos;
    let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (let n = 1; n < size; n++) {
      xref += offsets.has(n) ? String(offsets.get(n)).padStart(10, "0") + " 00000 n \n" : "0000000000 65535 f \n";
    }
    write(Buffer.from(xref + `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${badStartxref ? xrefAt + 7 : xrefAt}\n%%EOF\n`, "latin1"));
    return Buffer.concat(parts);
  }

  // Cross reference stream: dictionaries without streams go in one object stream.
  const packed = [...objs].filter(([, o]) => !o.stream).sort((a, b) => a[0] - b[0]);
  const direct = [...objs].filter(([, o]) => o.stream);
  const objStmNum = Math.max(...objs.keys()) + 1;
  const xrefNum = objStmNum + 1;
  let header = "";
  let bodies = "";
  for (const [num, o] of packed) {
    header += `${num} ${bodies.length} `;
    bodies += o.body + "\n";
  }
  const objStmData = zlib.deflateSync(Buffer.from(header + bodies, "latin1"));
  for (const [num, o] of direct) writeObj(num, o.body, o.stream);
  writeObj(objStmNum, `<< /Type /ObjStm /N ${packed.length} /First ${header.length} /Filter /FlateDecode /Length ${objStmData.length} >>`, objStmData);

  const size = xrefNum + 1;
  const rows = [];
  for (let n = 0; n < size; n++) {
    const row = Buffer.alloc(7);
    const idx = packed.findIndex(([k]) => k === n);
    if (n === xrefNum) { row[0] = 1; row.writeUInt32BE(pos, 1); }
    else if (idx >= 0) { row[0] = 2; row.writeUInt32BE(objStmNum, 1); row.writeUInt16BE(idx, 5); }
    else if (offsets.has(n)) { row[0] = 1; row.writeUInt32BE(offsets.get(n), 1); }
    rows.push(row);
  }
  // PNG "Up" predictor on every row, as many writers do.
  const predicted = [];
  let prev = Buffer.alloc(7);
  for (const r of rows) {
    const out = Buffer.alloc(8);
    out[0] = 2;
    for (let i = 0; i < 7; i++) out[i + 1] = (r[i] - prev[i]) & 255;
    predicted.push(out);
    prev = r;
  }
  const xrefData = zlib.deflateSync(Buffer.concat(predicted));
  const xrefAt = pos;
  writeObj(
    xrefNum,
    `<< /Type /XRef /Size ${size} /W [1 4 2] /Root 1 0 R /Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 7 >> /Length ${xrefData.length} >>`,
    xrefData
  );
  write(Buffer.from(`startxref\n${xrefAt}\n%%EOF\n`, "latin1"));
  return Buffer.concat(parts);
}

// A 1 bit DeviceGray scan in the USPTO style (/Decode [1 0], so 1 bits are
// black) with a black frame and a diagonal line, Flate compressed.
export function bilevelScan(width, height) {
  const rowBytes = Math.ceil(width / 8);
  const raw = Buffer.alloc(rowBytes * height);
  const set = (x, y) => { raw[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7); };
  for (let x = 0; x < width; x++) { set(x, 0); set(x, height - 1); }
  for (let y = 0; y < height; y++) { set(0, y); set(width - 1, y); set(Math.floor((y * (width - 1)) / (height - 1)), y); }
  return {
    width,
    height,
    dict: "/ColorSpace /DeviceGray /BitsPerComponent 1 /Decode [1 0] /Filter /FlateDecode",
    data: zlib.deflateSync(raw),
  };
}
