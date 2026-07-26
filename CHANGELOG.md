# Changelog

All notable changes to the **present** plugin are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [1.1.2] — 2026-07-25

### Fixed
- **Broken light mode + Mermaid diagrams in `page.html` and `slides.html`.** Both templates had the `{{LIB}}` placeholder a second time *inside a `//` JavaScript comment*, so inlining the bundled library (a global `{{LIB}}` replace) pasted ~3 MB of Mermaid into that comment — a syntax error that killed the whole `<script>`. Result: the theme toggle stopped working (light mode dead) and diagrams rendered with ugly defaults / as raw text. Each template now has exactly one `{{LIB}}` slot.

### Added (validation — this class of failure can no longer ship silently)
- **`build.js` now refuses** a template with a duplicate `{{LIB}}` slot, and its validator (`--check`, run on every output) errors on: a library inlined **inside a `//` comment**, and a `<pre class="mermaid">` diagram with **no Mermaid library inlined** (would render as raw text).
- Fixed a validator false-positive: `<html>`/`<body>` mentioned inside CSS comments no longer skews the structural duplicate-document counts (`<style>` bodies are now neutralized alongside `<script>` bodies).

## [1.1.1] — 2026-07-25

### Added
- **Mobile-responsive output** — every template (chart, diagram, slides, page, report) now ships mobile media queries: fluid `clamp()` type, grids that collapse (KPIs/cards stack), report tabs that scroll horizontally, tables/diagrams that scroll instead of overflowing, a repositioned toolbar, and (for slides) a hidden keyboard-hint bar on touch with a compact HUD.
- **`assets/scripts/build.js`** — a deterministic assembler + validator. Fills a template from a content JSON, inlines the bundled libraries **last**, and refuses to write a broken file. `--check <file>` validates any generated HTML (single document, no leftover `{{…}}`, every `<canvas>` has a `new Chart`, tabs↔panels match). The skill now mandates using it for reports and validating every output — this class of failure (duplicated content, unfilled `{{LIB}}`, empty charts) can no longer ship silently.

## [1.0.0] — 2026-07-25

First stable release. `present` turns data, code, logs, or plain instructions into self-contained, fully-offline HTML.

### Outputs
- **Charts** from data — CSV/JSON/TSV and **Excel `.xlsx`** → bar, line, pie/doughnut, scatter, radar, stacked, mixed (Chart.js).
- **Diagrams** from code/architecture or a description — flowchart, dependency/module graph, class, sequence, ER, state, timeline (Mermaid).
- **Presentations** — keyboard-navigable HTML decks (arrow/Prev/Next nav, progress bar, fullscreen, speaker notes, overview grid, charts embedded on slides).
- **Pages** — general self-contained HTML (landing pages, one-pagers, documents) authored from instructions.
- **Interactive reports** — a single-page report with **tabbed sections** and hover **tooltips**, KPI cards, charts, and diagrams (`report.html`).

### Design & theming
- Premium, professional default look across every template — richer palette, subtly tinted background, elevated cards with soft shadows + hover, gradient badges/buttons, gradient headlines & KPI numbers (with safe solid fallbacks), refined tables and tabs.
- **Light/dark theme toggle** (persisted) on every output. Charts follow the theme via `Chart.defaults`; diagrams re-render with plugin-matched Mermaid theme variables (node/text/edge/subgraph colors adapt).

### Local-first / offline
- **Fully offline by default** — bundles Chart.js + Mermaid and inlines them, so output needs no network and nothing leaves the machine (CDN is opt-in).
- **PDF export** on every output via the browser's print dialog.
- **Dependency-free `.xlsx` extractors** — PowerShell *and* Node.js, using only built-ins (no Excel, Python, or npm packages).

### Workflow
- Organized run output: `present-output/<slug>/` with a landing `index.html` and a `data/` folder.
- Proactively adds diagrams where they aid understanding.
- Ships as a proper marketplace (`.claude-plugin/marketplace.json`) so it installs with `/plugin marketplace add` + `/plugin install present@present`.

### Notable fixes hardened before release
- Light-mode "grey wash" — gradients now fade to a same-hue `rgba(…,0)` instead of `transparent` (which interpolates through black).
- Diagram guidance comment no longer contains example arrows that could HTML-terminate the comment and leak text.
- Verified end-to-end: all five templates render correctly in both light and dark; Chart.js draws and Mermaid renders + re-themes in a real browser.

### Install
```
/plugin marketplace add yudhvirc/claude-present-plugin
/plugin install present@present
/reload-plugins
```

[1.1.1]: https://github.com/yudhvirc/claude-present-plugin/releases/tag/v1.1.1
[1.0.0]: https://github.com/yudhvirc/claude-present-plugin/releases/tag/v1.0.0
