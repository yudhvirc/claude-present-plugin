#!/usr/bin/env node
/*
 * xlsx-to-json.js — Convert an .xlsx worksheet to JSON (or CSV) with ZERO npm dependencies.
 *
 * An .xlsx is a ZIP of XML parts. This reads the ZIP with Node's built-in `zlib`
 * and parses the XML with a tiny built-in parser — no packages, no Excel, no Python.
 * Data never leaves the machine. Node 14+.
 *
 * Usage:
 *   node xlsx-to-json.js <file.xlsx> [--list] [--sheet NAME] [--mode grid]
 *                        [--no-header] [--csv] [--out FILE]
 *
 *   --list       Print sheet names as a JSON array and exit.
 *   --sheet N    Sheet to read (default: first sheet).
 *   --mode grid  Emit raw row arrays instead of header-keyed objects.
 *   --no-header  In object mode, treat row 1 as data (columns become A,B,C...).
 *   --csv        Emit CSV instead of JSON (object mode only).
 *   --out FILE   Write to FILE instead of stdout.
 */
'use strict';
const fs = require('fs');
const zlib = require('zlib');

// ---------------------------------------------------------------- ZIP reader
function readZip(buf) {
  // locate End Of Central Directory (scan the tail for signature 0x06054b50)
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP/.xlsx file (no end-of-central-directory record).');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method  = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    // read the local header to find where the data actually starts
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    let content;
    if (method === 0) content = raw;                       // stored
    else if (method === 8) content = zlib.inflateRawSync(raw); // deflate
    else throw new Error('Unsupported ZIP compression method ' + method + ' for ' + name);
    entries[name] = content.toString('utf8');
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ---------------------------------------------------------------- tiny XML parser
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(parseInt(e[1] === 'x' || e[1] === 'X' ? e.slice(2) : e.slice(1), e[1] === 'x' || e[1] === 'X' ? 16 : 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e] || m;
  });
}
function localName(n) { const i = n.indexOf(':'); return i < 0 ? n : n.slice(i + 1); }
function parseXML(xml) {
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<(\/)?([^\s/>]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/)?>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    const [full, cdata, closing, tag, attrStr, selfClose, text] = m;
    if (cdata !== undefined) { stack[stack.length - 1].text += cdata; continue; }
    if (full.startsWith('<!--') || full.startsWith('<?') || full.startsWith('<!')) continue;
    if (text !== undefined) { stack[stack.length - 1].text += decodeEntities(text); continue; }
    if (closing) { if (stack.length > 1) stack.pop(); continue; }
    if (tag !== undefined) {
      const attrs = {};
      if (attrStr) {
        const ar = /([:\w.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g; let a;
        while ((a = ar.exec(attrStr))) attrs[a[1]] = decodeEntities(a[3] !== undefined ? a[3] : a[4]);
      }
      const node = { name: localName(tag), raw: tag, attrs, children: [], text: '' };
      stack[stack.length - 1].children.push(node);
      if (!selfClose) stack.push(node);
    }
  }
  return root;
}
const childrenNamed = (node, ln) => node.children.filter(c => c.name === ln);
const firstNamed = (node, ln) => node.children.find(c => c.name === ln) || null;
function descendants(node, ln, acc = []) {
  for (const c of node.children) { if (c.name === ln) acc.push(c); descendants(c, ln, acc); }
  return acc;
}
const allTText = (node) => descendants(node, 't').map(t => t.text).join('');
function findDeep(node, ln) { // first descendant (incl. self excluded) with localName
  for (const c of node.children) { if (c.name === ln) return c; const r = findDeep(c, ln); if (r) return r; }
  return null;
}

// ---------------------------------------------------------------- helpers
function colIndex(ref) {
  let n = 0; for (const ch of ref) { const c = ch.charCodeAt(0); if (c >= 65 && c <= 90) n = n * 26 + (c - 64); else break; }
  return n - 1;
}
function colName(idx) { let n = idx + 1, s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
function serialToDate(num, epochUTC) {
  const ms = epochUTC + Math.round(num * 86400000);
  const d = new Date(ms);
  const pad = (x) => String(x).padStart(2, '0');
  const ymd = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  if (d.getUTCHours() || d.getUTCMinutes() || d.getUTCSeconds()) return `${ymd}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  return ymd;
}
function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v) => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [headers.map(esc).join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}

// ---------------------------------------------------------------- CLI
function parseArgs(argv) {
  const o = { mode: 'objects' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') o.list = true;
    else if (a === '--csv') o.csv = true;
    else if (a === '--no-header') o.noHeader = true;
    else if (a === '--sheet') o.sheet = argv[++i];
    else if (a.startsWith('--sheet=')) o.sheet = a.slice(8);
    else if (a === '--mode') o.mode = argv[++i];
    else if (a.startsWith('--mode=')) o.mode = a.slice(7);
    else if (a === '--out') o.out = argv[++i];
    else if (a.startsWith('--out=')) o.out = a.slice(6);
    else if (!a.startsWith('-') && !o.path) o.path = a;
  }
  return o;
}

function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (!opt.path) { console.error('Usage: node xlsx-to-json.js <file.xlsx> [--list] [--sheet NAME] [--mode grid] [--no-header] [--csv] [--out FILE]'); process.exit(2); }
  const zip = readZip(fs.readFileSync(opt.path));
  const get = (n) => (n in zip ? parseXML(zip[n]) : null);

  const wb = get('xl/workbook.xml');
  if (!wb) throw new Error('Not a valid .xlsx (missing xl/workbook.xml).');
  const wbEl = firstNamed(wb, 'workbook');
  const pr = wbEl && firstNamed(wbEl, 'workbookPr');
  const date1904 = pr && (pr.attrs.date1904 === '1' || pr.attrs.date1904 === 'true');
  const epochUTC = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);

  // r:id -> worksheet target
  const rels = get('xl/_rels/workbook.xml.rels');
  const relMap = {};
  if (rels) for (const rel of firstNamed(rels, 'Relationships').children) {
    let t = rel.attrs.Target || '';
    t = t.startsWith('/') ? t.replace(/^\/+/, '') : 'xl/' + t.replace(/^\.\//, '');
    relMap[rel.attrs.Id] = t;
  }
  const sheetsEl = firstNamed(wbEl, 'sheets');
  const sheets = childrenNamed(sheetsEl, 'sheet').map(s => ({ name: s.attrs.name, target: relMap[s.attrs['r:id']] }));
  if (!sheets.length) throw new Error('No sheets found.');

  if (opt.list) { output(JSON.stringify(sheets.map(s => s.name)), opt); return; }

  const chosen = opt.sheet ? sheets.find(s => s.name === opt.sheet) : sheets[0];
  if (!chosen) throw new Error(`Sheet '${opt.sheet}' not found. Available: ${sheets.map(s => s.name).join(', ')}`);
  const sheetPath = chosen.target || 'xl/worksheets/sheet1.xml';

  // shared strings
  const shared = [];
  const ss = get('xl/sharedStrings.xml');
  if (ss) for (const si of childrenNamed(firstNamed(ss, 'sst'), 'si')) shared.push(allTText(si));

  // styles -> which cellXfs indexes are dates
  const dateStyle = [];
  const st = get('xl/styles.xml');
  if (st) {
    const sheet = firstNamed(st, 'styleSheet');
    const custom = {};
    const numFmts = firstNamed(sheet, 'numFmts');
    if (numFmts) for (const nf of childrenNamed(numFmts, 'numFmt')) custom[parseInt(nf.attrs.numFmtId, 10)] = nf.attrs.formatCode || '';
    const builtin = new Set([14,15,16,17,18,19,20,21,22,27,28,29,30,31,32,33,34,35,36,45,46,47,50,51,52,53,54,55,56,57,58]);
    const cellXfs = firstNamed(sheet, 'cellXfs');
    if (cellXfs) childrenNamed(cellXfs, 'xf').forEach((xf) => {
      const fid = xf.attrs.numFmtId ? parseInt(xf.attrs.numFmtId, 10) : 0;
      let isDate = builtin.has(fid);
      if (!isDate && fid in custom) {
        const code = custom[fid].replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '');
        if (/[yYdD]/.test(code) || /hh|HH|ss|SS|AM\/PM/.test(code)) isDate = true;
      }
      dateStyle.push(isDate);
    });
  }

  // worksheet cells
  const sh = get(sheetPath);
  if (!sh) throw new Error('Worksheet part not found: ' + sheetPath);
  const sheetData = findDeep(sh, 'sheetData') || { children: [] };
  const rows = [];
  let maxCol = -1;
  for (const row of childrenNamed(sheetData, 'row')) {
    const cells = {};
    for (const c of childrenNamed(row, 'c')) {
      const ref = c.attrs.r; if (!ref) continue;
      const ci = colIndex(ref); if (ci > maxCol) maxCol = ci;
      const t = c.attrs.t, s = c.attrs.s;
      const v = firstNamed(c, 'v'), is = firstNamed(c, 'is');
      let val = null;
      if (t === 's') { if (v) val = shared[parseInt(v.text, 10)]; }
      else if (t === 'inlineStr') { if (is) val = allTText(is); }
      else if (t === 'str') { if (v) val = v.text; }
      else if (t === 'b') { if (v) val = v.text === '1'; }
      else if (v && v.text !== '') {
        const num = parseFloat(v.text);
        const isDate = (s !== undefined && s !== '') ? !!dateStyle[parseInt(s, 10)] : false;
        val = isDate ? serialToDate(num, epochUTC) : num;
      }
      cells[ci] = val;
    }
    rows.push(cells);
  }

  const width = maxCol + 1;
  const rowArr = (cells) => Array.from({ length: width }, (_, j) => (j in cells ? cells[j] : null));
  let result;
  if (width <= 0) result = [];
  else if (opt.mode === 'grid') result = rows.map(rowArr);
  else {
    let headers, start;
    if (!opt.noHeader && rows.length) {
      const h = rowArr(rows[0]);
      headers = h.map((v, j) => (v !== null && String(v).trim() !== '') ? String(v) : colName(j));
      start = 1;
    } else { headers = Array.from({ length: width }, (_, j) => colName(j)); start = 0; }
    result = [];
    for (let i = start; i < rows.length; i++) {
      const arr = rowArr(rows[i]); const obj = {};
      for (let j = 0; j < width; j++) obj[headers[j]] = arr[j];
      result.push(obj);
    }
  }

  if (opt.csv) {
    if (opt.mode === 'grid') throw new Error('--csv requires object mode (omit --mode grid).');
    output(toCSV(result), opt);
  } else {
    output(JSON.stringify(result, null, 2), opt);
  }
}

function output(text, opt) {
  if (opt.out) { fs.writeFileSync(opt.out, text); process.stderr.write(`Wrote ${opt.out}\n`); }
  else process.stdout.write(text + '\n');
}

try { main(); } catch (e) { console.error('Error: ' + e.message); process.exit(1); }
