---
name: present
description: Turn data files (CSV/JSON/Excel), code/architecture, logs/command output, or a plain-text description into a visual — charts, diagrams, a keyboard-navigable PPT-style presentation, or a self-contained HTML page. Default output is a single self-contained HTML file that opens in any browser. Use when the user wants to "present", "visualize", "chart", "graph", "plot", "diagram", "draw", "make slides/a deck/a presentation", or "build an HTML page" from data or an idea.
---

# Visualize

Produce a visual from whatever the user gives you. The default and primary output is **one self-contained HTML file** that opens in any browser with no server. This skill ships bundled copies of **Chart.js** and **Mermaid** under `assets/lib/`.

**Two standing defaults:**
- **Fully offline by default.** Always inline the bundled libraries (Chart.js *and* Mermaid) into the HTML so it works with zero network access and nothing leaves the machine. Do not use CDN links unless the user explicitly asks for a smaller file.
- **Lean on diagrams.** Whenever a diagram would make something easier to understand, add one (Mermaid) — don't wait to be asked. Diagrams are inlined and therefore offline like everything else.

## Workflow

### 1. Identify the input type
Pick the closest match (a request can combine several):

| Input | Produce |
|-------|---------|
| **Data file** (CSV, JSON, Excel, TSV) | Chart(s) — bar, line, pie/doughnut, scatter, radar, area, stacked, mixed |
| **Code / a folder / architecture** | Diagram — flowchart, module/dependency graph, class diagram, sequence, ER (Mermaid) |
| **Logs / command output / tabular text** | Summary chart or a small dashboard (counts, timelines, distributions) |
| **Free-form description** ("draw a login flow", "chart these numbers…") | Whatever fits — a diagram or a chart |
| **"slides" / "deck" / "presentation" / "PPT"** | A keyboard-navigable HTML presentation (see Slides) |
| **Instructions to build content** ("make a presentation about X", "build an HTML landing page / one-pager / report about Y") | You **generate the content** from the request + your knowledge, then render it — a presentation (`slides.html`) or a general HTML page (`page.html`). See "Building from instructions". |

If the request is ambiguous about what to draw, ask **one** brief question, then proceed.

**Add a diagram wherever it aids understanding.** Beyond the literal request, proactively include a **Mermaid diagram** whenever it makes the result clearer — a process/flow, a system or folder architecture, a sequence of interactions, a decision tree, a data model (ER), a state machine, a timeline, or how parts relate. In pages, reports, and decks especially, prefer "show it as a diagram" over a dense paragraph; aim to include at least one diagram for anything involving a process, structure, or relationship. Keep diagrams readable (group, label, ≤ ~25 nodes).

### 2. Defaults — don't interrogate the user
Proceed with these defaults; ask a question only if the *request itself* is ambiguous (not to confirm setup):

- **Fully offline (default, always):** inline the bundled libraries from `assets/lib/` — **both Chart.js and Mermaid** — directly into the HTML (see "Embedding libraries"). The file works with no internet and nothing leaves the machine. Use CDN `<script>` tags **only** if the user explicitly asks for a smaller file and accepts needing internet to view.
- **Output format (default):** self-contained HTML. Offer **Mermaid** text or **SVG/PNG** only if the user asks or it's clearly better for their use.

### 3. Read and understand the input
- For data files: read the file, infer columns/types, pick sensible x/y and a chart type that fits the data shape. Aggregate/clean as needed. Never invent data — chart only what's present.
  - **CSV / TSV / JSON**: read directly with the Read tool.
  - **Excel (`.xlsx`)**: do NOT try to read the binary with the Read tool. Run the bundled extractor (no installs — see "Reading .xlsx" below) to get clean JSON, then chart that.
- For code/architecture: map the real structure (imports, modules, calls, entities). Keep the diagram readable — group and label; don't dump every edge.
- Summarize what you found before generating, so the user can correct you.

### 4. Generate the output — into an organized run folder
Never scatter files in the working directory. Every run writes into a dedicated folder (see "Output organization" below). Copy the matching template from `assets/templates/`, replace the marked placeholders, and write the result into that folder. Templates and their placeholders:

- **`chart.html`** — one or many Chart.js charts. Replace `{{TITLE}}`, `{{LIB}}`, `{{BODY}}`, `{{SCRIPT}}`.
- **`diagram.html`** — a Mermaid diagram. Replace `{{TITLE}}`, `{{LIB}}`, `{{DIAGRAM}}` (the Mermaid source), `{{DEFINITION_BLOCK}}`.
- **`slides.html`** — PPT-style presentation. Replace `{{TITLE}}`, `{{LIB}}`, `{{SLIDES}}`, `{{CHART_INIT}}`.
- **`page.html`** — general self-contained HTML page (landing page, one-pager, report, document, simple dashboard). Replace `{{TITLE}}`, `{{CONTENT}}` (the page body), `{{LIB}}` (only if it has charts), `{{SCRIPT}}` (optional JS). `page.html` and `slides.html` also expose `--display-font`/`--body-font` for an optional offline aesthetic direction (see authoring.md → "Visual polish").

Each placeholder appears **exactly once** in a template (except `{{TITLE}}`, which fills both `<title>` and the heading). When you fill a template, also delete the `<!-- … placeholder below … -->` guidance comments so the output is clean.

**Fill order matters (avoid corrupting inlined libraries).** The bundled minified libraries contain sequences like `<!--`, `-->`, and `{{…}}` inside their own source. So:
1. Replace the text placeholders (`{{TITLE}}`, `{{BODY}}`/`{{CONTENT}}`/`{{SLIDES}}`, `{{SCRIPT}}`/`{{CHART_INIT}}`, `{{DIAGRAM}}`, …) and remove the guidance comments **while `{{LIB}}` is still an empty placeholder**.
2. Inline the library into `{{LIB}}` **last**.
Never run a broad regex (comment strip, leftover-`{{…}}` cleanup, minifier) across the document *after* a library is inlined — it will silently mangle the library. If you must clean up, do it before the final inline step.

**Every template ships two built-in controls — no wiring needed:**
- **Light/dark theme toggle** (☀/☾ button, `T` key in slides), persisted in `localStorage`. Colors come from CSS variables; charts follow the theme via `Chart.defaults`, and diagrams re-render with Mermaid's matching theme. So in `chart.html`/slides, **don't hardcode tick/grid colors** in chart configs — omit them and they follow the theme.
- **PDF export** (⤓ PDF button, `P` key) via the browser's print dialog → "Save as PDF". Chart/diagram pages auto-switch to the light theme for readable paper and restore after; slides print one landscape page each.

See `references/authoring.md` for exactly how to fill each placeholder, chart-config recipes, Mermaid diagram-type picking, and slide structure.

### 5. Report
Tell the user the **run folder** path and which file to open (double-click, or `start <folder>\index.html` on Windows). Note whether it's offline-capable. Don't paste the whole HTML into chat — summarize what you built and list the artifacts.

## Output organization (required)
Every run creates one self-contained folder so artifacts never litter the working directory and a run can be moved or zipped as a unit.

- **Location:** `present-output/<slug>/` in the current working directory — unless the user names a location, then use that. `<slug>` is a short kebab-case name from the dataset/topic (e.g. `company-2025`, `login-flow`, `northbrew-landing`). If that folder already exists and holds an unrelated run, add a short suffix (e.g. `-2`) rather than overwriting. (The Write tool creates parent folders automatically — just write to the full path.)
- **Layout:**
  ```
  present-output/<slug>/
    index.html          # landing page linking every artifact — ALWAYS create it when a run produces 2+ artifacts
    charts.html         # the generated artifact(s), simply named by type
    deck.html
    diagram.html
    page.html           # (general HTML pages; name it index.html if it's the only artifact)
    data/               # intermediate/derived data only — e.g. extracted spreadsheet JSON/CSV
      <sheet>.json
  ```
- **Naming inside the folder:** use plain type names (`charts.html`, `deck.html`, `diagram.html`); no need to repeat the slug. A single general page with no siblings can just be `index.html`.
- **`data/`** holds only data you derived (e.g. `xlsx-to-json` output). **Never copy the user's original source files** into the run folder, and never move/delete their input.
- **`index.html`** (multi-artifact runs): build it from `page.html` — a title, one `.card` per artifact with a short description and a link (`<a class="btn" href="charts.html">Open charts</a>`), and a note on offline/privacy. It inherits the theme toggle + PDF export.
- **Privacy interaction:** in fully-local mode everything in the folder (inlined libs + embedded data) works offline with no network; say so in the report and (optionally) in `index.html`.

When extracting `.xlsx`, point the extractor's output into the run folder's `data/`, e.g. `--out present-output/<slug>/data/monthly.json`.

## Building from instructions (content you generate)
When the user describes what they want rather than handing you data — e.g. "make a 6-slide deck introducing our onboarding process", "build an HTML landing page for a coffee subscription", "turn these notes into a one-pager", "create an interactive HTML page that shows a countdown" — **you author the content**, then render it into a self-contained HTML file:

1. **Pick the shape:** a *presentation* → `slides.html`; a *page / document / landing page / report / dashboard* → `page.html`; if it's really just a chart or a diagram, use those templates instead.
2. **Draft the content** from the request and your own knowledge. Keep presentations to one idea per slide; keep pages well-structured (clear headings, short paragraphs, `.card`/`.grid`/tables where useful). Embed charts (Chart.js) where there's data, and **add a Mermaid diagram wherever it makes the content easier to understand** — for any process, architecture, timeline, or relationship, include at least one diagram rather than a dense paragraph. (Both libraries are inlined, so the page stays fully offline.) For a polished, non-generic look, apply the **"Visual polish"** section of `references/authoring.md` — commit to one aesthetic direction and set an offline font preset via `--display-font`/`--body-font`. (Applies to `page.html`/`slides.html` only; keep charts/diagrams neutral.)
3. **Ask only what's needed:** if key specifics are missing (audience, length, tone, must-include points, brand color), ask one short question — otherwise proceed with sensible defaults and note the assumptions.
4. **Accuracy:** only state facts you're confident in. For anything uncertain or time-sensitive, hedge, leave a clearly-marked placeholder (e.g. `[confirm figure]`), or ask — never fabricate specifics (names, stats, quotes, prices).
5. Fill the template, **inline the libraries (fully-offline default)**, write the file, and report the path.

The theme toggle and PDF export are built into `page.html` and `slides.html`, so instruction-built decks and pages are print-ready and light/dark-switchable with no extra work.

## Reading .xlsx (Excel) files
An `.xlsx` is a ZIP of XML — it can't be read as text. Convert it to JSON first with one of the two bundled, **dependency-free** extractors (both handle numbers, booleans, shared/inline strings, and dates → ISO-8601, and keep data on-device). Pick whichever runtime is available — they take the same options and produce the same output:

**PowerShell** (uses .NET's built-in ZIP/XML — no modules):
```powershell
powershell -ExecutionPolicy Bypass -File "<skill>/assets/scripts/xlsx-to-json.ps1" -Path "data.xlsx" -List
powershell -ExecutionPolicy Bypass -File "<skill>/assets/scripts/xlsx-to-json.ps1" -Path "data.xlsx" -Sheet "Sales" -Out "present-output/<slug>/data/sales.json"
```
Options: `-Sheet <name>` (default first sheet), `-Mode grid`, `-NoHeader`, `-Csv`, `-Out <file>`.

**Node.js** (uses built-in `zlib` + a tiny XML parser — no npm install):
```bash
node "<skill>/assets/scripts/xlsx-to-json.js" data.xlsx --list
node "<skill>/assets/scripts/xlsx-to-json.js" data.xlsx --sheet Sales --out present-output/<slug>/data/sales.json
```
Options: `--sheet <name>`, `--mode grid`, `--no-header`, `--csv`, `--out <file>`.

Then Read the resulting JSON and build the chart from it. Default output is an array of row objects keyed by the header row.

**Further fallbacks** if neither PowerShell nor Node is available, or the sheet is unusual: (1) if the user has Python with `pandas`/`openpyxl`, use `pandas.read_excel(...)`; (2) ask the user to **Save As → CSV** in Excel and point you at the CSV. Whichever path, chart only real values — never fabricate.

## Embedding libraries (fully offline — the default)
Inline **every** library the output uses. If a page has a chart *and* a diagram, inline **both** (Chart.js and Mermaid). To inline, read the file from `assets/lib/` and place its contents inside a `<script>…</script>` tag where the template's `{{LIB}}` placeholder sits:

- Chart.js → `assets/lib/chart.umd.min.js`
- Mermaid → `assets/lib/mermaid.min.js`

(A pure content page with neither a chart nor a diagram needs no `{{LIB}}` at all.)

**CDN mode is opt-in only** — use it *only* when the user explicitly asks for a smaller file and accepts needing internet to view. Then replace `{{LIB}}` with the CDN tag instead:
- `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.9/dist/chart.umd.min.js"></script>`
- `<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>`

Mermaid is ~3 MB, so a diagram-bearing offline file is ~3.3 MB (charts-only stays ~200 KB). That is the expected cost of offline diagrams — **do not** drop to CDN to shrink it unless the user asks; just mention the size if it's relevant.

## Output formats other than HTML
- **Mermaid text**: just return the fenced ```mermaid block (no template needed).
- **SVG**: for Mermaid diagrams, the browser can save the rendered SVG; for a true static export you can offer to render via the HTML file. For charts, prefer HTML (Chart.js is canvas-based) unless the user specifically needs a static image, in which case describe the trade-off.

## Slides (PPT-style presentations)
The `slides.html` template is a small, self-contained slide engine — no external presentation framework. It supports:
- **Navigation**: → / ↓ / Space / PageDown = next; ← / ↑ / PageUp = previous; `Home`/`End`; on-screen **Prev/Next** buttons; a slide counter and progress bar.
- **Fullscreen**: press `F`. **Overview grid**: press `Esc`.
- **Speaker notes**: press `S` to toggle a notes panel (notes live in each slide's `data-notes`).
- **Charts on slides**: each slide can contain a `<canvas>`; wire it up in `{{CHART_INIT}}` using the bundled Chart.js.
- **PDF export**: press `P` or the **⤓ PDF** button to open the browser's print dialog and "Save as PDF" — one slide per landscape page, chrome hidden, charts re-rendered for print. Fully offline (no export library). Set `PRINT_NOTES = true` in the template to print speaker notes under each slide.

Keep one idea per slide, large readable type, minimal text. See `references/authoring.md` for the slide markup contract.
