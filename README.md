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

## Preview
Real, self-contained, fully-offline HTML output from `/present`:

**Data → charts** (built from an Excel workbook, with a light/dark toggle + PDF export)
![Charts dashboard](docs/screenshot-charts.png)

**Presentation** — keyboard-navigable deck (arrows, fullscreen, speaker notes, PDF)
![Slide deck](docs/screenshot-deck.png)

**HTML page** — generated from a one-line instruction
![Landing page](docs/screenshot-page.png)

## Installation

**Requirements:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code). No runtime dependencies — generated HTML opens in any browser, fully offline. (PowerShell *or* Node.js is only needed to read `.xlsx` spreadsheets; both ship with most systems.)

### Install from GitHub (recommended)
In Claude Code, add this repo as a plugin marketplace, then install the plugin:
```shell
/plugin marketplace add yudhvirc/claude-present-plugin
/plugin install present@present
/reload-plugins
```
`present@present` = plugin **present** from the **present** marketplace. To update later: `/plugin marketplace update present`.

### Team / project install (via settings)
Commit this to a project's `.claude/settings.json` so everyone working in the repo gets it automatically:
```json
{
  "extraKnownMarketplaces": {
    "present": { "source": { "source": "github", "repo": "yudhvirc/claude-present-plugin" } }
  },
  "enabledPlugins": { "present@present": true }
}
```

### Developer / local install
Clone the repo, then add the cloned folder as a marketplace by absolute path:
```bash
git clone https://github.com/yudhvirc/claude-present-plugin.git
```
```shell
/plugin marketplace add /absolute/path/to/claude-present-plugin
/plugin install present@present
/reload-plugins
```

### Verify & manage
```shell
/plugin list               # should list present@present
/plugin details present
/plugin disable present    # or: /plugin enable present
```

### Troubleshooting
**`Marketplace present not found`** — you must add the marketplace *before* installing (this error means the `add` step didn't register). Run the add first and confirm it appears:
```shell
/plugin marketplace add yudhvirc/claude-present-plugin
/plugin marketplace list          # should show: present
/plugin install present@present
```
If a stale entry is stuck, remove it and re-add:
```shell
/plugin marketplace remove present
/plugin marketplace add yudhvirc/claude-present-plugin
```

## Usage
The skill **auto-activates** when you ask for something visual — just describe what you want:
- "present sales.csv as a bar chart of revenue by region"
- "diagram the architecture of the src/ folder"
- "make a 6-slide deck from these Q3 numbers with a revenue chart"
- "build an HTML landing page for a coffee subscription"

You can also invoke it explicitly: `/present:present`.

It will ask about **privacy** (fully-offline with libraries inlined, vs. smaller files via CDN) and **output format** (defaults to self-contained HTML; can also emit Mermaid text or SVG), then write the result into an organized `present-output/<slug>/` folder.

## Structure
```
.claude-plugin/marketplace.json     Marketplace listing (enables /plugin install)
plugins/present/                    The plugin (source: ./plugins/present)
  .claude-plugin/plugin.json        Plugin manifest
  skills/present/
    SKILL.md                        Skill instructions (workflow)
    references/authoring.md         How to fill templates + chart/diagram recipes
    assets/templates/               chart.html · diagram.html · slides.html · page.html
    assets/lib/                     Bundled Chart.js + Mermaid (offline)
    assets/scripts/xlsx-to-json.ps1 Dependency-free .xlsx → JSON/CSV extractor (PowerShell)
    assets/scripts/xlsx-to-json.js  Dependency-free .xlsx → JSON/CSV extractor (Node.js)
examples/                           Sample inputs + generated outputs
```

## License
MIT — see [LICENSE](LICENSE). Bundles Chart.js and Mermaid (both MIT).
