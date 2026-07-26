# Bundled fonts (offline designer-font presets)

These variable `woff2` files are inlined as base64 by `build.js --fonts <preset>` so a generated
HTML file uses a polished typeface while staying **fully self-contained and offline** (no network,
nothing leaves the machine).

| File | Family | Axis | Use |
|------|--------|------|-----|
| `fraunces-variable.woff2` | Fraunces | weight 100–900 | display / headings |
| `inter-variable.woff2` | Inter | weight 100–900 | body / UI |

Preset `fraunces-inter` pairs them (elegant serif headings + clean sans body).

## Licenses

Both are licensed under the **SIL Open Font License 1.1** (redistribution permitted, including embedding):

- **Inter** — © The Inter Project Authors — https://github.com/rsms/inter
- **Fraunces** — © The Fraunces Project Authors — https://github.com/undercasetype/Fraunces

The `latin` (weight-axis) subsets were retrieved from the Fontsource packages
`@fontsource-variable/inter` and `@fontsource-variable/fraunces` on jsDelivr.

## Adding a preset

Drop the `woff2` in this folder and add an entry to `FONT_PRESETS` in
`../scripts/build.js` (family, file, weight range, and the `--display-font` / `--body-font` stacks).
