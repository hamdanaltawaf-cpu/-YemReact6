# Paper & Amber — component library and motion specification

## Visual language

A warm editorial Arabic interface: paper ground, restrained ink, amber emphasis, cinematic portrait cards, a torn-paper Qusasa mark and technical micro-labels. Glass is reserved for the sticky header and preview controls; light shadows give depth without applying every visual trend everywhere.

The original Qusasa path remains unchanged. Gradient IDs are now unique with `useId`.

## Semantic tokens (`src/app/globals.css`)

| Token | Light default | Dark default | Role |
|---|---|---|---|
| `--bg` | `#f5f1ea` | `#151714` | Canvas |
| `--surface` | `#fffdf9` | `#20231e` | Dialog/form surfaces |
| `--ink` | `#20221e` | `#f3eee6` | Primary text |
| `--muted` | `#595b52` | `#b0b3a7` | Supporting text |
| `--line` | `#dfded5` | `#383d32` | Dividers |
| `--soft` | `#ece9e1` | `#292d25` | Secondary fills |
| `--accent` | `#c1592e` | same | Brand emphasis |
| `--accent-text` | darkened accent | lightened accent | Legible emphasis text |
| `--paper` | `#f3eae0` | same | Fixed mark/paper color |

Other curated accent options are `#367567` and `#6863ac`. A constrained palette is intentional: arbitrary color inputs can destroy contrast. Primary button fills darken the selected accent slightly to maintain legibility. All nine category colors remain fixed semantic identifiers.

Theme choice: system/light/dark, persisted. A small bootstrap script applies stored appearance before paint. Reduced motion combines the OS preference and the explicit in-app setting.

## Components

| Level | Component / class | Contract |
|---|---|---|
| Atom | `Qusasa` | size, tone, className; decorative SVG |
| Atom | `.btn`, `.icon-btn` | Native button or link; visible focus, disabled feedback |
| Atom | `.eyebrow`, `.mono`, `.status-pill` | Supporting hierarchy; not substitutes for headings |
| Molecule | search form | Native submit, explicit accessible label, optional `/` shortcut |
| Molecule | category tabs | Buttons with `aria-pressed`, overflow scroll on small screens |
| Molecule | `ReactionCard` | One media record; separate preview, bookmark and detail controls |
| Molecule | `ClipPlayer` | Native video controls, fixed aspect ratio, load errors, demo disclosure |
| Molecule | `ReactionActions` | Real file download, bookmark persistence, OS share/clipboard fallback |
| Primitive | `Modal` | Native dialog focus trapping, Escape, labelled title, backdrop dismissal |
| Organism | `Header`, `Footer` | Responsive navigation, skip link, settings and activity tray |
| Organism | `Preview` | Media lightbox, next/previous buttons, optional horizontal swipe |
| Organism | `Settings` | Appearance and reduced-motion controls; real install prompt if available |
| Organism | `AppProvider` | Public catalog, account, collection, appearance, notifications |
| Template | `Library` | Shared browse/saved template, URL query/category, load-more groups of 8 |
| Template | `Admin` | Read-only public inventory; authenticated owner workflows |

## Responsive strategy

- Container: 1248px default maximum; 1336px at wide desktop.
- Breakpoints: 1150 / 850 / 650 / 360 CSS px, chosen around content rather than device brands.
- Gallery: 4 → 3 → 2 columns. Card caption size also uses container units.
- Mobile: stacked hero, horizontal category navigation, collapsible global nav.
- Tables: keyboard-focusable scroll regions; no `overflow:hidden` masking missing controls.
- Media keep aspect ratios before fetch; there is no global horizontal-overflow suppression.

## Motion budget

| Interaction | Duration | Behavior |
|---|---:|---|
| Immediate button/selection feedback | 100–150ms | color/background |
| Modal entrance | 180ms | opacity + 12px translation |
| Toast | 180ms, visible ~4.2s | opacity + translation; live status |
| Hero entrance | 550ms | CSS vertical movement, no opacity gate; disabled for reduced motion |
| Preview contents | 180ms | on-demand Framer Motion opacity/translation |
| Card image hover | 500ms | scale 1 → 1.055, no layout reflow |
| Polaroid hover | 250ms | small rotation/translation, pointer only |
| Word ribbon | 60s per loop | decorative continuous marquee |

CSS disables animation/transitions for reduced motion. Native scrolling and keyboard remain usable. No custom cursor is imposed, no scroll hijacking, no parallax tied to wheel events, no autoplaying audio/video, no heavy particles or shaders.
