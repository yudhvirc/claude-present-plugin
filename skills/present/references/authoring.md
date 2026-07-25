# Authoring reference — how to fill each template

This is the detailed guide the `present` skill points to. Read it before generating output.

## Golden rules
- **One self-contained file.** All data is embedded in the HTML. No fetch(), no external data files.
- **Never fabricate data.** Chart/label only what exists in the source. If a value is missing, leave it out and say so.
- **Only include the library the output needs.** Charts → Chart.js. Diagrams (or slides containing a Mermaid diagram) → Mermaid. Slides with only `<canvas>` charts → Chart.js. Slides with neither → no `{{LIB}}` at all.
- **Theme-aware colors.** Every template has a light/dark toggle driven by CSS variables (`--bg --card --ink --muted --grid --accent`). Default is dark. **Do NOT hardcode chart tick/grid colors** — omit `scales.*.ticks.color` and `grid.color` so they inherit `Chart.defaults` and follow the theme. You may still set dataset/series colors (bars, lines, slices) — those stay constant across themes. Mermaid diagrams re-render with the matching Mermaid theme automatically.

## Built-in controls (all templates, nothing to fill in)
- **Theme toggle** — ☀/☂ button (and `T` in slides); persisted in `localStorage` under `viz-theme`.
- **PDF export** — ⤓ PDF button / `P` key → browser print dialog → "Save as PDF". `chart.html` and `diagram.html` switch to the light theme just for printing (readable on paper) and restore after; `slides.html` prints one landscape page per slide. These are wired via `beforeprint`/`afterprint` in each template — leave them intact.

## `{{LIB}}` — the one placeholder every template shares
Decide from the privacy answer:

- **Fully local:** read the bundled file and paste its contents inside a script tag:
  `<script>…entire contents of assets/lib/chart.umd.min.js…</script>`
  (or `mermaid.min.js`). Use the Read tool on the lib file, then embed. Mermaid is ~3 MB — that's fine for offline.
- **CDN OK:**
  - Chart.js → `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.9/dist/chart.umd.min.js"></script>`
  - Mermaid → `<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>`

## Preparing data (CSV / JSON / Excel)
- **CSV/TSV/JSON** — Read directly. Infer types; strip thousands separators / currency symbols before charting numbers.
- **Excel `.xlsx`** — never Read the binary. Convert with a bundled dependency-free extractor — `assets/scripts/xlsx-to-json.ps1` (PowerShell) **or** `assets/scripts/xlsx-to-json.js` (Node); both take the same options and emit the same shape (see SKILL.md "Reading .xlsx"): an array of row objects keyed by the header row, dates as ISO strings. List sheets first if unsure (`-List` / `--list`), then pick one (`-Sheet` / `--sheet`). Fallbacks: pandas/openpyxl, or ask the user for a CSV export.
- Always eyeball the extracted rows and confirm the columns with the user before generating, so a mislabeled header or a wrong sheet is caught early.

## chart.html
- `{{TITLE}}` — page/report title.
- `{{BODY}}` — one `.card` per chart. Each card: `<div class="card"><h2>Chart title</h2><div class="wrap"><canvas id="chartN"></canvas></div></div>`. Use a unique `id` per canvas.
- `{{SCRIPT}}` — one `new Chart(...)` per canvas. Always set `responsive:true, maintainAspectRatio:false` (the `.wrap` gives a fixed height).

### Picking a chart type
| Data shape | Type |
|---|---|
| Category → value | `bar` (vertical) or `bar` with `indexAxis:'y'` (horizontal, many categories) |
| Value over time / ordered x | `line` (set `tension:.3` for smooth; `fill:true` for area) |
| Parts of a whole (≤ ~6 slices) | `pie` or `doughnut` |
| Two numeric vars / correlation | `scatter` (data as `{x,y}` points) |
| Multi-metric per item | `radar`, or grouped `bar` with several datasets |
| Cumulative composition over time | stacked `bar`/`line` (`stacked:true` on both scales) |
| Mixed units | `type:'bar'` chart with a dataset overridden to `type:'line'` + a second y-axis |

Colors: use a small palette, e.g. `['#38bdf8','#34d399','#fbbf24','#f87171','#a78bfa','#f472b6']`.

## diagram.html
- `{{DIAGRAM}}` — the raw Mermaid source (NOT fenced with backticks) placed between the `<pre class="mermaid">` tags. Keep original indentation minimal; Mermaid is whitespace-tolerant but avoid leading indentation on the first line.
- `{{DEFINITION_BLOCK}}` — optional short caption/legend, or leave blank.

### Picking a Mermaid diagram type
| Need | Mermaid |
|---|---|
| Process / decision flow | `flowchart TD` (or `LR`) |
| Module / dependency / call graph | `flowchart LR` with subgraphs per package |
| Interaction over time between actors | `sequenceDiagram` |
| Classes / types / inheritance | `classDiagram` |
| Data model / tables & relations | `erDiagram` |
| States / lifecycle | `stateDiagram-v2` |
| Timeline / roadmap | `gantt` or `timeline` |

Keep it readable: group with `subgraph`, label edges, and don't exceed ~25 nodes — split or summarize instead. Escape problematic text in `["…"]` node labels.

### Code → architecture tips
- Derive edges from real imports/requires/includes and function calls. Group files by folder/package into `subgraph`s.
- For a large repo, show the top 2 levels (packages → key modules), not every file.

## slides.html
- `{{SLIDES}}` — one `<section class="slide">` per slide. Contract:
  - First slide may be `class="slide title"`.
  - Add `data-notes="…"` for speaker notes (shown when the presenter presses **S**).
  - Body: `<h1>`/`<h2>` + short `<ul>`/`<p>`; or a `<div class="chart-wrap"><canvas id="deckChartN"></canvas></div>`.
  - One idea per slide. Large type, few words (the template scales font to viewport).
- `{{CHART_INIT}}` — one `new Chart(...)` per slide canvas. Only include `{{LIB}}` (Chart.js) if at least one slide has a chart.
- To put a **Mermaid diagram on a slide**, embed Mermaid as the lib, add `<pre class="mermaid">…</pre>` in the slide, and call `mermaid.initialize({startOnLoad:true})` in `{{CHART_INIT}}`.

Built-in controls (no code needed): arrows/space/PageUp-Down/Home/End nav, Prev/Next buttons, counter, progress bar, **F** fullscreen, **S** notes, **Esc** overview grid, **P** / **⤓ PDF** export, swipe on touch, and deep-linking via `#<slide-number>`.

### PDF export
The template exports to PDF through the browser's own print dialog — no library, works offline. `beforeprint`/`afterprint` handlers add a `.printing` layout (one slide per landscape page, chrome hidden) and call `Chart.getChart(canvas).resize()` so canvas charts rasterize at print size. Nothing to fill in — it works as soon as slides exist. Two optional tweaks:
- **Include speaker notes in the PDF**: set `const PRINT_NOTES = true;` in the script (notes print beneath each slide from `data-notes`).
- **Portrait pages**: change `@page { size: landscape; }` to `portrait` in the print CSS.

If you tell the user how to save the PDF, say: press **P** (or click **⤓ PDF**) → in the print dialog choose **Destination: Save as PDF** → Save.

## page.html (general HTML from instructions)
Use for anything that isn't primarily a single chart, diagram, or slide deck: landing pages, one-pagers, reports, documents, simple dashboards, or small interactive pages.
- `{{CONTENT}}` — the full page body inside `.container`. Use the provided classes: `.lead`, `.muted`, `.card`, `.grid` (auto-fit columns), `.badge`, `.btn`, styled `table`/`code`/`pre`. Structure with `<h2>`/`<h3>`. For a chart, drop `<div class="chart-wrap"><canvas id="p1"></canvas></div>` in the content and create it in `{{SCRIPT}}`.
- `{{LIB}}` — include **only** if the page has a `<canvas>` chart (inline Chart.js or CDN). Omit for pure content pages.
- `{{SCRIPT}}` — optional page JS (chart creation, interactivity). Charts follow the theme via `Chart.defaults` — don't hardcode tick/grid colors.
- Theme toggle + PDF export are already wired in. For a Mermaid diagram inside a page, inline Mermaid as `{{LIB}}`, add `<pre class="mermaid">…</pre>` in the content, and call `mermaid.initialize({startOnLoad:true})` in `{{SCRIPT}}`.

When authoring content from a user's instructions, generate accurate, well-organized copy; mark anything uncertain as `[confirm …]` rather than inventing specifics.

## Visual polish (page.html & slides.html ONLY)
Raises the design quality of instruction-built pages and decks without sacrificing offline output or determinism. **Do NOT apply any of this to `chart.html` / `diagram.html`** — those stay neutral and clarity-first. The theme toggle, PDF export, and deterministic defaults must keep working.

**1. Commit to ONE aesthetic direction** for the whole page/deck, then apply it consistently (this is what keeps a bolder look still predictable — not per-element improvising):
`editorial` · `minimal` · `warm` · `technical` · `refined`. Match it to the topic (a coffee brand → warm; a research report → editorial; a dev tool → technical).

**2. Typography — set the two font variables** the templates expose (`--display-font` for headings, `--body-font` for text). Use **offline system-font stacks only** — no web fonts, no `@import`, no `fonts.googleapis`. Prefer characterful OS-installed faces over the plainest defaults. Presets:
| Direction | `--display-font` (headings) | `--body-font` (text) |
|---|---|---|
| editorial | `'Iowan Old Style','Palatino Linotype',Georgia,serif` | `Georgia,'Times New Roman',serif` |
| refined | `Baskerville,'Palatino Linotype',Constantia,Georgia,serif` | `'Palatino Linotype',Georgia,serif` |
| warm | `'Segoe UI Semibold','Corbel',Candara,system-ui,sans-serif` | `Corbel,Candara,'Segoe UI',system-ui,sans-serif` |
| technical | `'Cascadia Code',Consolas,ui-monospace,Menlo,monospace` | `system-ui,-apple-system,'Segoe UI',sans-serif` |
| minimal | `system-ui,-apple-system,'Segoe UI',Roboto,sans-serif` | `system-ui,-apple-system,'Segoe UI',Roboto,sans-serif` |

Set them once in `:root` (e.g. `:root{ --display-font:'Iowan Old Style',...; --body-font:Georgia,... }`). Pair a display stack with a readable body stack; keep a clear size hierarchy. If the user genuinely needs a specific custom typeface, bundle it as a base64 `@font-face` `src:url(data:font/woff2;base64,…)` so the file stays self-contained — **never** a network font URL.

**3. Color — cohesion, via the existing CSS variables** (`--bg --panel --ink --muted --border --accent`, plus `--link` on page): pick one dominant background family + ONE sharp accent; recolor `--accent` (and `.slide.title` gradient / hero) to fit the direction. Always set BOTH the dark and light values so the toggle keeps working. Avoid the cliché "AI-slop" purple gradient and timid, evenly-weighted palettes.

**4. Spatial composition** — strong hierarchy and intentional whitespace (or controlled density). Reuse `.card` / `.grid` / `.badge` / `.btn` on pages; one idea per slide on decks. A page may open with a larger hero (bigger `h1`, a `.lead`, a divider).

**5. Motion — CSS-only and restrained.** Slides already fade. At most add a subtle load fade-up to a page hero. Don't scatter micro-interactions; predictability and print/PDF fidelity come first.

**Anti-patterns to avoid** (from good frontend practice): generic "AI" look, default-only fonts, cliché gradients, scattered unmotivated animations, timid color. **Hard constraints:** fully offline (system fonts / data-URI only), charts & diagrams untouched, theme + PDF + determinism intact.

## Filling templates cleanly
- Every fill-in placeholder appears **exactly once** (only `{{TITLE}}` repeats — `<title>` + heading). Replace each with its content.
- **Delete the `<!-- … placeholder below … -->` guidance comments** as you fill, so the output has no leftover instructions. (This also avoids ever inlining a library into a comment.)
- **Inline the library (`{{LIB}}`) LAST.** The minified Chart.js/Mermaid source contains `<!--`, `-->`, and `{{…}}` sequences of its own, so any comment-strip or leftover-placeholder cleanup must run *before* the library is inlined. Never run a broad regex over the finished file after inlining — it will corrupt the library (e.g. a global `<!--…-->` strip eats from a `<!--` inside Mermaid to a later `-->`, breaking it). Verify the output's JS is intact (the diagram renders / charts draw) before delivering.

## After generating
- Write into the run folder `present-output/<slug>/` (see SKILL.md "Output organization"), using plain type names: `charts.html`, `deck.html`, `diagram.html`, or `index.html` for a lone page. Put derived data in `data/`. Don't scatter files in the working directory or copy the user's source files.
- If the run produced 2+ artifacts, build an `index.html` (from `page.html`) that links each one with a short description.
- Do a quick self-check: every `canvas id` has a matching `new Chart`, JSON is valid, `{{LIB}}` is present when needed, and no `{{PLACEHOLDER}}` or guidance comments remain.
- Tell the user the folder path + `start <slug>\index.html` (Windows) to open, and whether it's offline-capable.
