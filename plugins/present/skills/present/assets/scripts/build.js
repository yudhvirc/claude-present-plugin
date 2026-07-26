#!/usr/bin/env node
/*
 * build.js — deterministically assemble a `present` template into a valid, self-contained HTML file,
 * and validate it. Prevents the failure mode where the model hand-edits a multi-MB file and duplicates
 * content, leaves {{LIB}} unfilled, or forgets a chart config.
 *
 * ASSEMBLE:
 *   node build.js --template report --content content.json --out out.html [--libs chart,mermaid] [--cdn]
 *   --template : a bundled name (chart|diagram|slides|page|report) or a path to a template .html
 *   --content  : JSON whose keys are placeholder names WITHOUT braces, e.g.
 *                { "TITLE":"…", "SUBTITLE":"…", "TABS":"…html…", "PANELS":"…html…", "SCRIPT":"…js…" }
 *                (Provide the content as strings — do NOT paste libraries here.)
 *   --libs     : which bundled libraries to inline into {{LIB}} (default: none). Inlined LAST, in order.
 *   --cdn      : use CDN <script> tags for --libs instead of inlining (opt-in; needs internet to view).
 *   --out      : output path.
 *
 * VALIDATE an existing file:
 *   node build.js --check out.html
 *
 * The build ALWAYS validates before writing and refuses to emit a broken file.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const LIB_DIR = path.join(__dirname, '..', 'lib');
const TPL_DIR = path.join(__dirname, '..', 'templates');

const CDN = {
  chart: '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.9/dist/chart.umd.min.js"></script>',
  mermaid: '<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>',
};
const LIB_FILE = { chart: 'chart.umd.min.js', mermaid: 'mermaid.min.js' };

function parseArgs(a) {
  const o = { libs: [] };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--template') o.template = a[++i];
    else if (k === '--content') o.content = a[++i];
    else if (k === '--out') o.out = a[++i];
    else if (k === '--libs') o.libs = a[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (k === '--cdn') o.cdn = true;
    else if (k === '--check') o.check = a[++i];
  }
  return o;
}

function resolveTemplate(t) {
  if (!t) throw new Error('--template is required');
  if (fs.existsSync(t)) return t;
  const p = path.join(TPL_DIR, t.endsWith('.html') ? t : t + '.html');
  if (fs.existsSync(p)) return p;
  throw new Error('template not found: ' + t);
}

function stripGuidance(h) {
  // Remove only the "… placeholder below …" guidance comments (never touches inlined libs — libs are added later).
  return h.replace(/<!--[\s\S]*?-->/g, m => (/placeholder below/.test(m) ? '' : m));
}

function libBlock(libs, cdn) {
  return libs.map(l => {
    if (!(l in LIB_FILE)) throw new Error('unknown lib: ' + l + ' (use chart|mermaid)');
    if (cdn) return CDN[l];
    const f = path.join(LIB_DIR, LIB_FILE[l]);
    if (!fs.existsSync(f)) throw new Error('bundled lib missing: ' + f);
    return '<script>' + fs.readFileSync(f, 'utf8') + '</script>';
  }).join('\n');
}

// Validate a fully-assembled document. Structural checks strip inline <script> BODIES first so an
// inlined library's own text (which can contain "<!DOCTYPE", "<html", etc.) never skews the counts.
function validate(html, opts) {
  opts = opts || {};
  const errs = [], warns = [];
  const skel = html.replace(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g, '<script></script>');
  const n = (re, s) => ((s || skel).match(re) || []).length;

  if (n(/<!DOCTYPE html>/gi) !== 1) errs.push(`expected exactly 1 <!DOCTYPE>, found ${n(/<!DOCTYPE html>/gi)} — content is duplicated`);
  if (n(/<html[\s>]/gi) !== 1) errs.push(`expected exactly 1 <html>, found ${n(/<html[\s>]/gi)}`);
  if (n(/<\/html>/gi) !== 1) errs.push(`expected exactly 1 </html>, found ${n(/<\/html>/gi)}`);
  if (n(/<body[\s>]/gi) !== 1) errs.push(`expected exactly 1 <body>, found ${n(/<body[\s>]/gi)}`);
  if (n(/<nav class="tabs"/g) > 1) errs.push(`report structure duplicated: ${n(/<nav class="tabs"/g)} <nav class="tabs"> (should be 1)`);

  let left = html.match(/\{\{[A-Z_]+\}\}/g) || [];
  if (opts.allowLib) left = left.filter(x => x !== '{{LIB}}');   // {{LIB}} is inlined last, so it's expected pre-inline
  if (left.length) errs.push(`unfilled placeholders remain: ${[...new Set(left)].join(', ')}`);

  // Every <canvas id> must have a matching Chart.js init.
  const canvases = [...html.matchAll(/<canvas[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
  canvases.forEach(id => {
    const re = new RegExp(`getElementById\\(['"]${id}['"]\\)|new Chart\\(\\s*${id}\\b`);
    if (!re.test(html)) warns.push(`canvas #${id} has no matching new Chart(...) — it will render blank`);
  });

  // Report tabs must map to real panels and vice-versa.
  const tabIds = [...html.matchAll(/data-panel="([^"]+)"/g)].map(m => m[1]);
  const panelIds = [...html.matchAll(/<section class="panel[^"]*" id="([^"]+)"/g)].map(m => m[1]);
  if (tabIds.length || panelIds.length) {
    const noPanel = tabIds.filter(t => !panelIds.includes(t));
    const noTab = panelIds.filter(p => !tabIds.includes(p));
    if (noPanel.length) errs.push(`tabs without a matching panel: ${noPanel.join(', ')}`);
    if (noTab.length) warns.push(`panels with no tab: ${noTab.join(', ')}`);
  }

  // Mermaid used but not inlined/loaded?
  if (/<pre class="mermaid"/.test(html) && !/mermaid\.(min\.)?js|cdn.*mermaid|function\(JM/i.test(html)) {
    warns.push('a <pre class="mermaid"> is present but the Mermaid library is not inlined — pass --libs mermaid');
  }
  return { errs, warns, canvases: canvases.length, panels: panelIds.length };
}

function report(v, label) {
  v.warns.forEach(w => console.error('  ! ' + w));
  if (v.errs.length) { console.error(`FAIL ${label}:`); v.errs.forEach(e => console.error('  ✗ ' + e)); return false; }
  console.error(`OK ${label} (canvases: ${v.canvases}, panels: ${v.panels}, warnings: ${v.warns.length})`);
  return true;
}

function main() {
  const o = parseArgs(process.argv.slice(2));

  if (o.check) {
    const html = fs.readFileSync(o.check, 'utf8');
    process.exit(report(validate(html), o.check) ? 0 : 1);
  }

  const tplPath = resolveTemplate(o.template);
  let html = fs.readFileSync(tplPath, 'utf8');
  const content = o.content ? JSON.parse(fs.readFileSync(o.content, 'utf8')) : {};

  // 1) strip guidance comments (safe — no library inlined yet)
  html = stripGuidance(html);
  // 2) fill every text placeholder from content.json (LIB handled separately, last)
  for (const [k, val] of Object.entries(content)) {
    if (k === 'LIB' || k === 'LIBS' || k === 'CDN') continue;
    html = html.split('{{' + k + '}}').join(val == null ? '' : String(val));
  }
  // 3) drop any remaining non-LIB placeholders (unused optional slots) so validation is meaningful
  html = html.replace(/\{\{(?!LIB\}\})[A-Z_]+\}\}/g, '');
  // 4) validate BEFORE inlining libraries (skeleton is clean; errors are readable). {{LIB}} is expected here.
  if (!report(validate(html, { allowLib: true }), 'pre-inline')) { console.error('Refusing to write a broken file.'); process.exit(1); }
  // 5) inline libraries LAST (or CDN)
  html = html.split('{{LIB}}').join(libBlock(o.libs, o.cdn));
  // 6) final validation on the assembled document
  if (!report(validate(html), 'assembled')) process.exit(1);

  if (!o.out) throw new Error('--out is required to write output');
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  fs.writeFileSync(o.out, html);
  console.error(`Wrote ${o.out} (${(html.length / 1048576).toFixed(2)} MB${o.libs.length ? ', libs inlined: ' + o.libs.join('+') : ''})`);
}

try { main(); } catch (e) { console.error('Error: ' + e.message); process.exit(1); }
