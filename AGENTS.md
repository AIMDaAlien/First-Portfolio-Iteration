# M3 EXPRESSIVE WEB SPECIFICATION (STRICT)
**Version:** 3.0 (Feb 2026)
**Seed Color:** #8E99F3 (Pastel Periwinkle)
**Mode:** Dark
**Stack:** Vanilla HTML / CSS / JavaScript (no frameworks, no build tools)

---

## 1. COLOR SYSTEM (Periwinkle HCT Dark Palette)

All tokens live in `m3e-tokens.css` under `:root`.

### Primary
| Token | Value | Usage |
|---|---|---|
| `--md-sys-color-primary` | `#BBC3FF` | Links, active indicators, accent text |
| `--md-sys-color-on-primary` | `#1F2578` | Text on primary-filled surfaces |
| `--md-sys-color-primary-container` | `#383F90` | Card backgrounds, badges |
| `--md-sys-color-on-primary-container` | `#DEE0FF` | Text on primary containers |

### Secondary (Desaturated Periwinkle)
| Token | Value |
|---|---|
| `--md-sys-color-secondary` | `#C4C4DD` |
| `--md-sys-color-on-secondary` | `#2D2F42` |
| `--md-sys-color-secondary-container` | `#444559` |
| `--md-sys-color-on-secondary-container` | `#E0E0F9` |

### Tertiary (Warm Rose)
| Token | Value |
|---|---|
| `--md-sys-color-tertiary` | `#E8B9D5` |
| `--md-sys-color-on-tertiary` | `#46263B` |
| `--md-sys-color-tertiary-container` | `#5F3C52` |
| `--md-sys-color-on-tertiary-container` | `#FFD8EE` |

### Surface System
| Token | Value | Usage |
|---|---|---|
| `--md-sys-color-surface` | `#121318` | Page background |
| `--md-sys-color-surface-dim` | `#121318` | Low-prominence background |
| `--md-sys-color-surface-bright` | `#38393F` | High-prominence background |
| `--md-sys-color-surface-container-lowest` | `#0D0E13` | Deepest layer |
| `--md-sys-color-surface-container-low` | `#1A1B21` | Recessed panels |
| `--md-sys-color-surface-container` | `#1E1F25` | Default card/container background |
| `--md-sys-color-surface-container-high` | `#292A30` | Elevated containers |
| `--md-sys-color-surface-container-highest` | `#34343B` | Top-level overlays |

### Text, Outline, Inverse
| Token | Value |
|---|---|
| `--md-sys-color-on-surface` | `#E4E1E9` |
| `--md-sys-color-on-surface-variant` | `#C6C5D0` |
| `--md-sys-color-outline` | `#908F9A` |
| `--md-sys-color-outline-variant` | `#46464F` |
| `--md-sys-color-inverse-surface` | `#E4E1E9` |
| `--md-sys-color-inverse-on-surface` | `#303036` |
| `--md-sys-color-inverse-primary` | `#505AA6` |

### State Layers
```
hover   0.08  ->  --state-hover: rgba(187, 195, 255, 0.08)
focus   0.12  ->  --state-focus: rgba(187, 195, 255, 0.12)
press   0.16  ->  --state-press: rgba(187, 195, 255, 0.16)
dragged 0.16
```

---

## 2. SHAPE SYSTEM

```css
--md-sys-shape-corner-extra-small:  4px;
--md-sys-shape-corner-small:        8px;
--md-sys-shape-corner-medium:       16px;
--md-sys-shape-corner-large:        24px;
--md-sys-shape-corner-extra-large:  28px;   /* The "Expressive" default */
--md-sys-shape-corner-full:         9999px;
```

Cards and dialogs default to `28px`. Use progressive enhancement for squircle via `paint(squircle)` where supported.

---

## 3. MOTION SYSTEM (Spring Physics)

All interactive animations use `linear()` spring easing. Standard `cubic-bezier` is forbidden for interactions.

### `--motion-spring-bouncy` (Stiffness 200 / Damping 15)
For hover states, toggles, icon presses.
```css
linear(
    0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%, 0.938 16.7%, 1.074 20.8%,
    1.137 25.2%, 1.146 29.8%, 1.119 34.8%, 1.077 40.1%, 1.036 45.9%,
    1.007 52.3%, 0.991 59.8%, 0.996 76%, 1 100%
)
```

### `--motion-spring-expressive` (Stiffness 300 / Damping 30)
For container entrances, modals, page transitions.
```css
linear(
    0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 15.2%, 0.719 19.6%, 0.849 24.3%,
    0.937 29.2%, 0.986 34.3%, 1.006 39.7%, 1.008 45.4%, 1.001 51.5%,
    0.999 57.8%, 1 100%
)
```

### `--motion-morph` (always 500ms)
For border-radius animations (square to circle transitions).
```css
linear(0, 0.005, 0.02 2.2%, 0.65 14.8%, 0.85 20.8%, 1 100%)
```

### Duration Tokens
```
--duration-short:       200ms
--duration-medium:      300ms
--duration-long:        500ms
--duration-extra-long:  700ms
```

Reduced motion: all spring easings fall back to `ease` via `@media (prefers-reduced-motion: reduce)`.

---

## 4. TYPOGRAPHY

**Brand font:** Ubuntu (Display, Headline, Title, Body, Label)
**Code font:** JetBrains Mono (terminal, code blocks)

| Role | Size | Weight | Line Height | Tracking |
|---|---|---|---|---|
| Display Large | 57px | 700 | 64px | -0.25px |
| Headline Large | 32px | 600 | 40px | 0 |
| Title Large | 22px | 500 | 28px | 0 |
| Body Large | 16px | 400 | 24px | 0.5px |
| Label Large | 14px | 500 | 20px | 0.1px |

---

## 5. INTERACTION PROTOCOLS

1. **Squeeze:** On click/active, scale element to `0.95` using `--motion-spring-bouncy`.
2. **Lift:** On hover, `translateY(-4px)` + `scale(1.02)` using `--motion-spring-bouncy`. Combine with surface-container elevation shift.
3. **Morph:** On state change, animate `border-radius` (e.g., `28px` to `4px`) over `500ms` using `--motion-morph`.

---

## 6. FILE STRUCTURE

```
/
├── index.html                 Main portfolio page
├── garden-terminal.html       Knowledge Garden terminal page
├── m3e-tokens.css             Design tokens (colors, shape, motion, type)
├── style.css                  Main site styles (index.html)
├── garden-terminal.css        Terminal page styles (garden-terminal.html)
├── terminal-privacy.css       Redacted text / matrix decode effect
├── script.js                  Main site JS (BIOS boot, matrix footer, uptime)
├── terminal.js                Contact section privacy redaction
├── garden-terminal.js         Terminal class: commands, file tree, vault API
├── garden-graph.js            D3 force-directed graph visualization
└── AGENTS.md                  This file
```

### Key architectural notes
- **No build step.** All CSS and JS is loaded directly via `<link>` and `<script>`.
- **No frameworks.** No React, no Tailwind, no shadcn. Pure vanilla HTML/CSS/JS.
- `m3e-tokens.css` is loaded first and provides all `:root` custom properties.
- `style.css` and `garden-terminal.css` consume those tokens.
- `garden-terminal.js` defines the `KnowledgeGarden` class that fetches from GitHub API.

---

## 7. TERMINAL COMMANDS REFERENCE

Commands implemented in `garden-terminal.js` `executeCommand()`:

| Command | Description |
|---|---|
| `cat [file]` / `open [file]` | View a note from the vault |
| `help` | List available commands |
| `man [cmd]` | Show manual page for a command |
| `theme [dark\|light]` | Switch color scheme |
| `clear` | Clear terminal output |
| `neofetch` | Display system info card |
| `cowsay [text]` | ASCII cow with message |
| `matrix` | Matrix rain animation |
| `whoami` | Print current user identity |
| `sudo` | Permission denied easter egg |

### Planned (Phase 7 expansion)
`ls`, `cd`, `pwd`, `head`, `find`, `grep`, `tree` -- filesystem navigation commands for the vault.

---

## 8. ELEVATION

Dark-mode M3 elevation uses shadow + surface tint, not just box-shadow.

```css
--elevation-1: 0 1px 3px 1px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.3);
--elevation-2: 0 2px 6px 2px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.3);
--elevation-3: 0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3);
```

Higher elevation = lighter surface tint (use `surface-container-high` / `surface-container-highest`).

---

## 9. FORBIDDEN PATTERNS

**DO NOT:**
- Use Tailwind CSS classes. This is a vanilla CSS project.
- Use shadcn/ui components. There is no component library.
- Reference `layout.tsx`, `globals.css`, or any Next.js/React file. There is no framework.
- Use `cubic-bezier` for interactive animations. Use `linear()` spring tokens.
- Use Material 2 styles (flat shadows, sharp corners, Roboto).
- Use default `12px` border-radius. Expressive default is `28px`.
- Use dense layouts. M3 Expressive requires generous whitespace.
- Use bottom tab bars on desktop. Use a floating navigation rail.
- Add npm dependencies or build tooling. Everything ships as plain files.
- Introduce a CSS preprocessor (no Sass, no PostCSS). Raw CSS only.
- Use light-mode colors (#7C3AED lavender, white surfaces). The palette is dark-mode periwinkle.
- Use `Roboto` or system fonts for brand text. The brand font is `Ubuntu`.
