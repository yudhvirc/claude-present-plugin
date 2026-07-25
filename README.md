# present — Claude Code plugin

Turn **data files, code/architecture, logs, or a plain-text description** into a **self-contained HTML visual** — charts, diagrams, a keyboard-navigable PPT-style presentation, or a general HTML page. Local-first: bundles Chart.js + Mermaid so output works fully offline.

## What it does
Invoke the skill and describe (or point at) what you want to present:
- **Data → charts** — CSV/JSON/TSV, and **Excel `.xlsx`** (via a bundled dependency-free extractor) → bar, line, pie, scatter, radar, stacked, mixed (Chart.js).
- **Code/architecture → diagrams** — flowcharts, dependency/module graphs, class, sequence, ER (Mermaid).
- **Logs / command output → summary dashboards.**
- **Free-form description → the fitting diagram or chart.**
- **"Make a deck / slides / presentation"** → a self-contained HTML presentation with arrow-key navigation, Prev/Next buttons, progress bar, fullscreen (F), speaker notes (S), an overview grid (Esc), and charts embedded on slides.
- **"Build an HTML page/landing page/one-pager about X"** → Claude generates the content from your instructions and renders a general self-contained HTML page (`page.html`) — theme toggle + PDF export included.

Default output is **one self-contained `.html` file**. It also asks about **privacy** (fully-local → libraries are inlined so nothing needs the internet; or CDN if you prefer a smaller file) and can emit **Mermaid text** or **SVG** when you'd rather have those. Every run is written into an organized `present-output/<slug>/` folder (with an `index.html` landing page when there are multiple artifacts).

## Usage
```
/present
```
Then tell it what to present, e.g.:
- "present sales.csv as a bar chart of revenue by region"
- "diagram the architecture of the src/ folder"
- "make a 6-slide deck from these Q3 numbers with a revenue chart"
- "build an HTML landing page for a coffee subscription"

## Structure
```
.claude-plugin/plugin.json        Plugin manifest
skills/present/
  SKILL.md                        Skill instructions (workflow)
  references/authoring.md         How to fill templates + chart/diagram recipes
  assets/templates/               chart.html · diagram.html · slides.html · page.html
  assets/lib/                     Bundled Chart.js + Mermaid (offline)
  assets/scripts/xlsx-to-json.ps1 Dependency-free .xlsx → JSON/CSV extractor (PowerShell)
  assets/scripts/xlsx-to-json.js  Dependency-free .xlsx → JSON/CSV extractor (Node.js)
```

## Install
Clone the repo and load it as a Claude Code plugin:
```bash
git clone https://github.com/yudhvirc/claude-present-plugin.git
```
Point Claude Code at the cloned folder as a plugin (or add it to a plugin marketplace), then invoke it with `/present`. It requires no runtime dependencies — generated output opens in any browser, fully offline.

## License
MIT — see [LICENSE](LICENSE). Bundles Chart.js and Mermaid (both MIT).
