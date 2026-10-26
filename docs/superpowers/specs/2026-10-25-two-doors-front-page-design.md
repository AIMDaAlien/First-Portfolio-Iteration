# Two Doors Front Page: Design

**Date:** 2026-10-25
**Status:** approved in conversation (mock-up v2); awaiting written-spec review
**Mock-up:** `.superpowers/brainstorm/89199-1792983763/content/doors-v2.html` (local only, not committed)

## 1. Goal

Make the portfolio main page (`index.html`) interesting to two audiences at once:

- **Normal visitors** should learn who Aim is and see a few results they can understand without technical background.
- **Experienced engineers** should find proof: real charts, specs, live telemetry, and honest failures, each linked to the note behind it.

Both audiences should end up curious enough to open the Knowledge Garden or get in touch.

## 2. Decisions the owner made

| Decision | Choice |
|---|---|
| Page shape | "Two doors": a switch under the hero between **the short version** and **the deep end** |
| Visual theme | Keep the existing homepage theme exactly: hero card, bracketed mono chips, `card-led` labels, `pcb-divider`s, Ubuntu section titles, `spec-unit` cards, dark periwinkle tokens |
| Default door | The short version, with nudges toward the deep end |
| Deep link | `?door=deep` opens the deep end. It is for the owner's LinkedIn project entry |
| Charts | Zoomable full-screen viewer; drawn at 90% opacity, full on hover |
| Skill gauges | Removed. Skills are shown as one measured result each, linked to the note |
| Complexity bars on projects | Removed |
| Hero image | No image for now. The fumo (Patchouli) belongs to the garden. The owner will supply a different image later |
| Hardware collage | Deferred. The owner hasn't made it yet |
| teardown.cafe | Out of the portfolio (already done 2026-10-25) |
| Handoff notes | Out of the published vault (already done 2026-10-25) |

## 3. Page structure

Order from top to bottom. "Shared" sections are visible in both doors.

1. **Hero (shared).** This is the existing hero card. The subtitle becomes the owner's line, "i build and break my own servers, then write down what actually happened.", which replaces the jargon line. The status strip stays.
2. **Door switch (shared).** It sits directly under the hero card:
   - A `card-led` label, "SELECT DEPTH".
   - A pill with two buttons, `[ the short version ]` and `[ the deep end ]`.
   - A hint line under the pill:
     - Short version: "plain words, big numbers · 2 min read · the charts live in the deep end". The last phrase is lavender and acts as the nudge.
     - Deep end: "charts, specs, telemetry · bring coffee".
3. **The short version** (`data-door-panel="short"`):
   1. **Hi there,** has three plain sentences in the owner's voice:
      > i'm studying IT at george mason and i've been running my own servers since i was 13. most of what i do is take hardware nobody wanted, make it fast, and keep honest notes about what worked and what didn't. off the keyboard i'm an animanga enthusiast, i forage for rare plants, and i ride mountain bikes.

      There is an optional image slot to the left of the text. It has no placeholder: when no image is configured the text takes the full width.

      The Zig Ziglar epigraph and the four about-cards (GMU, 6+ years, Linux, studying) are removed from this door. Their facts live in the sentences above and in Experience.
   2. **Things I've Done:** three `spec-unit` cards. Each card has a `card-led` tag, a big mono number, a one-line title, a one-sentence plain explanation, and `[ read the story → ]`, which opens its garden note.
   3. **Experience Timeline:** today's cards, unchanged.
   4. **Where I Write It Down:** the garden invite, with the live count ("375 notes · 7 topics") and one button into the garden.
   5. **Nudge card:** a `spec-unit` with `card-led` "THAT WAS THE SHORT VERSION", the line "want the actual charts, the server specs, live telemetry, and the experiment i threw out?", and a `[ open the deep end → ]` button.
4. **The deep end** (`data-door-panel="deep"`):
   1. **Lab Results:** chart cards. The first one is wide (chart and text side by side), the rest sit in a two-column grid. Each card has:
      - a `card-led` tag (e.g. `STRATA-3060 · PAIRED A/B`)
      - the chart in a framed box: white charts get a white frame, dark charts a `#0D0E13` frame
      - a big mono headline number
      - an optional one-line `spec-line`
      - `[ read the write-up → ]`
   2. **Machine Spec:** today's section (spec cards, live telemetry, incident sign), unchanged.
   3. **Skills, With Receipts:** this replaces "Skills & Expertise" and its gauges. It is a list of rows. Each row is a skill name (mono, uppercase, lavender), one measured result, and a link to the note.
   4. **Technical Projects:** today's cards with the complexity bars removed. Each card links to its garden write-up where one exists.
   5. **Technical Documentation:** today's garden stats and latest notes.
5. **Want to Chat? (shared):** today's contact section and footer.

Section anchors and the nav: nav links point at sections, and a link into a hidden door switches to that door first. `#machine-spec`, `#projects` and `#skills` live in the deep end; `#about` and `#experience` live in the short version; `#knowledge-garden-showcase` lives in the deep end, and the short version's garden invite has the id `#garden-invite`. The nav's "Skills" link is renamed "Lab" and points at Lab Results.

## 4. Content (curated, hand-written into `index.html`)

The charts and numbers are curated by hand. The images load from the public vault at `https://raw.githubusercontent.com/AIMDaAlien/Obsidian-Vault/main/<url-encoded path>`. Note links use `garden-terminal.html?note=<url-encoded path>`. During the build, every number below is checked against its note. A number that the note doesn't say is not used.

### Things I've Done (short version)

| Tag | Number | Title | Line | Note |
|---|---|---|---|---|
| STRATA-V100 | 62s → 1s | an old datacenter card, answering instantly | a long chat's next reply used to take a minute. now it takes a second. | `01 Projects/Strata/Strata V100 update — 2026-10-25.md` |
| STRATA-3060 | 16.6% | faster answers on a gaming card | proven with paired tests, not one lucky run. | `01 Projects/Strata/Strata RTX 3060 Optimization Showcase.md` |
| PHILOSOPHER | 0 / 40 | made-up quotes from my philosophy ai | 40 questions built to tempt it into faking a source. it never did. | `01 Projects/Philosopher/Philosopher Project.md` |

### Lab Results (deep end)

| Order | Image (vault path) | Headline | Note |
|---|---|---|---|
| 1, wide | `_attachments/strata-v100-update-20261025/headline.png` | 62s → 1s next reply | Strata V100 update — 2026-10-25 |
| 2 | `_attachments/strata-rtx3060-showcase/accepted-response-times.png` | −16.58% response time | Strata RTX 3060 Optimization Showcase |
| 3 | `_attachments/lcb60-pareto.png` | quality vs speed, pareto frontier | Model Benchmarks |
| 4 | `_attachments/strata-v100-tuning-20261018/headline.png` | 67 → 90 tok/s decode | Strata V100 Optimization Showcase |
| 5 | `_attachments/strata-rtx3060-showcase/expert-campaign-gate.png` | didn't ship it: missed the 5% bar | Strata RTX 3060 Optimization Showcase |

### Skills, With Receipts (deep end)

There are four to six rows. Each one is checked against its note:

- **GPU tuning:** V100 decode 67 → 90 tok/s, power-capped. Links to Strata V100 Optimization Showcase.
- **Self-hosting:** Unraid and TrueNAS behind Caddy, with a published incident log. Links to 00 - Server Inventory.
- **AI evaluation:** a 45-task research benchmark in which thinking flipped the ranking. Links to the v4 Results note.
- **Networking:** Pi-hole and Unbound, moved from a 2014 B+ to a Pi 5. Links to the Raspberry Pi note.
- **Operations:** a team of 8+ technicians, with turnaround cut 15%. Links to the Experience section, not a note.

## 5. Behaviour

- **Door choice:**
  - The `door` URL parameter wins.
  - Otherwise `localStorage['home-door']` applies (wrapped in try/catch).
  - Otherwise the page opens on `short`.
  - Switching doors updates `localStorage` and the URL with `history.replaceState` (`?door=deep`, or no parameter for short), then scrolls to the switch.
  - The buttons carry `aria-pressed`, and the panels use the `hidden` attribute so screen readers skip the closed door.
- **Scroll animations in a newly opened door:** `animate-on-scroll` elements in the door that was just opened get re-observed, so they reveal properly.
- **Live widgets:** telemetry, the incident sign and garden stats load whichever door is open, so they are ready when it is revealed.
- **Chart viewer:**
  - Clicking or pressing Enter on a chart opens a full-screen dialog.
  - Zoom with the wheel or a trackpad pinch toward the pointer, with two-finger pinch on touch, or with − / +. The range is 1× to 6×.
  - Drag pans the image. Double-click or double-tap toggles 2.5×, and "fit" resets.
  - Esc, ✕ or a backdrop click closes it, and focus returns to the chart.
  - Page scroll is locked while it's open.
  - The bar has a "read the write-up →" link.
  - Reduced motion means no transition animations.
- **Chart opacity:** 0.9 at rest, 1 on hover or focus. A "⤢ zoom" tag appears on hover or focus.
- **Missing image:** if a chart fails to load, its frame shows "chart unavailable · read the write-up" and the card stays.

## 6. Files

- `index.html`: the restructured sections, the door switch, the curated content, the dialog markup.
- `style.css`: styles for the door switch, proof cards, lab cards, receipts list, nudge and viewer. Gauge (`.vu-meter`) and complexity-bar styles are removed if nothing else uses them.
- `home-doors.js` (new): door state and the chart viewer.
- `home-doors-logic.js` (new, pure, UMD like `garden-graph-logic.js`):
  - `pickDoor(search, stored)` decides which door opens.
  - `clampZoom(s)`, `zoomAt(state, factor, px, py)` and `panBy(state, dx, dy, bounds)` keep the image covering the viewport.
- `tests/home-doors-logic.test.js`: node --test coverage for that logic.
- `AGENTS.md` (git-ignored, local only): add the two new files to the file list.

There is no build step and no new dependencies.

## 7. Testing

- **Unit tests:**
  - door choice from the URL, then storage, then the default;
  - rejection of unknown door values;
  - zoom limits;
  - zoom keeping the point under the cursor fixed;
  - pan staying in bounds;
  - the full suite stays green.
- **Headless browser, at 1440 and 390 wide:**
  - no horizontal overflow in either door;
  - the door switch, nudge and `?door=deep` all work;
  - nav links into a closed door open it;
  - the chart viewer zooms, pans and closes;
  - the live widgets fill in;
  - there are no console errors;
  - reduced motion is respected.
- **Screenshots of both doors** go to the owner before pushing.

## 8. Out of scope

- The hardware collage. A slot can be added later when it exists.
- The new hero or about image. The slot is in the code but stays empty until the owner supplies a file.
- Moving teardown.cafe content into the garden.
- Visual identity changes: palette, fonts, motion tokens.
