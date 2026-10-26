# Two Doors Front Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `index.html` into a shared hero, a door switch, a "short version" panel and a "deep end" panel, plus a shared contact section. Charts from the public vault can be zoomed.

**Architecture:**
- Pure decision logic (door choice, hash→door, zoom/pan math) lives in a UMD file tested with `node --test`.
- A small DOM script, `home-doors.js`, wires the switch, the nav and the chart viewer to that logic.
- Content is hand-curated markup in `index.html`. Images load from `raw.githubusercontent.com/AIMDaAlien/Obsidian-Vault/main/…`, and links go to `garden-terminal.html?note=…`.

**Tech Stack:** vanilla HTML/CSS/JS, no build step, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-25-two-doors-front-page-design.md`

## Global Constraints

- No npm dependencies, no build tooling, no frameworks. Plain `<script defer>` files.
- **Theme:**
  - Reuse the existing homepage classes: `hero-card`, `status-strip`, `card-led`, `pcb-divider`, `section-title`, `spec-unit`, `spec-line`, `content-section`, `project-card`.
  - Colours come from tokens: `--md-sys-color-*`, `--lavender`, `--muted`, `--border`, `--panel-glass`, `--mono`.
  - Interactive motion uses the `linear()` spring tokens (`--motion-spring-bouncy`). Never `cubic-bezier`.
  - Under `prefers-reduced-motion: reduce`, transitions fall back to none.
- Every box that sets `width: 100%` with padding uses `box-sizing: border-box`. Grid tracks use `minmax(0, …)`.
- No horizontal overflow at 390px or 1440px.
- **Copy:**
  - Body copy is lowercase in the owner's voice.
  - "IT" stays uppercase.
  - Section titles keep Title Case like today's ("Things I've Done", "Lab Results", "Skills, With Receipts").
- **Numbers:** every number on the page must appear in the note it links to. If it doesn't, drop or reword it.
- **No fumo image on the main page.** The image slot renders nothing until `data-photo` is set.
- **Door values:** exactly `short` and `deep`.
- **Storage:** the storage key is `home-door`, and the URL parameter is `door`. Default `short`.
- **Charts:** 0.9 opacity at rest, 1 on hover or focus. Zoom range 1–6×, and double-click toggles 2.5×.
- **Commits:** author `-c user.name=AIMDaAlien -c user.email=AIMDaAlien@users.noreply.github.com`, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage explicit paths only. Never stage `.DS_Store`, `.gitignore`, `unraid-metrics-publisher.sh`, `.superpowers/`, `concepts/` or `docs/homelab/`.

## Review Focus

1. A bad `?door=` value (`?door=DEEP`, `?door=x`, `?door=`) falls back to stored, then to `short`. Never a blank page.
2. A `localStorage` that throws (private mode or blocked storage) still lets the page open and switch doors.
3. Arriving at `index.html#machine-spec` (a hash inside the closed door) opens that door and scrolls to the section.
4. A chart image that 404s shows "chart unavailable · read the write-up" inside its frame, and the card keeps its layout.
5. Live widgets in the door that starts closed (garden stats, the incident sign) are filled when that door is opened, not stuck at "...".

---

### Task 1: Door and zoom logic

**Files:**
- Create: `home-doors-logic.js` (UMD: `window.HomeDoorsLogic` / `module.exports`, the same wrapper style as `garden-graph-logic.js`)
- Test: `tests/home-doors-logic.test.js`

**Interfaces:**
- Produces:
  - `DOORS = ['short', 'deep']`
  - `pickDoor(search: string, stored: string|null) -> 'short'|'deep'`: the URL parameter `door` wins if valid, then a valid stored value, then `'short'`.
  - `doorSearch(search: string, door) -> string`: the new query string, with `door=deep` set for deep, removed for short, and other parameters kept. It returns `''` or a string starting with `'?'`.
  - `doorForHash(hash: string) -> 'short'|'deep'|null`:
    - `#about`, `#experience` and `#garden-invite` map to `short`;
    - `#lab`, `#machine-spec`, `#skills`, `#projects` and `#knowledge-garden-showcase` map to `deep`;
    - anything else, including `#hero`, `#contact` and `''`, maps to `null`.
  - `clampZoom(s: number) -> number`: clamps to [1, 6].
  - `zoomAt(state {s,x,y}, factor, px, py) -> {s,x,y}`: zooms about the point (px, py), measured from the image centre in screen px, so that point stays fixed. If the result is s=1, then x=y=0.
  - `panBy(state, dx, dy, bounds {w,h,vw,vh}) -> {s,x,y}`. `w` and `h` are the image's unscaled rendered size and `vw`/`vh` the viewport. It limits x and y so the scaled image can't be dragged past its edges:
    - `|x| ≤ max(0, (w*s - vw)/2)`
    - and the same for y.

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../home-doors-logic.js');

test('pickDoor: url wins, then storage, then short', () => {
  assert.equal(D.pickDoor('?door=deep', 'short'), 'deep');
  assert.equal(D.pickDoor('', 'deep'), 'deep');
  assert.equal(D.pickDoor('', null), 'short');
});
test('pickDoor ignores unknown values', () => {
  assert.equal(D.pickDoor('?door=DEEP', null), 'short');
  assert.equal(D.pickDoor('?door=x', 'deep'), 'deep');
  assert.equal(D.pickDoor('?door=', 'nope'), 'short');
});
test('doorSearch sets door=deep, drops it for short, keeps other params', () => {
  assert.equal(D.doorSearch('', 'deep'), '?door=deep');
  assert.equal(D.doorSearch('?door=deep', 'short'), '');
  assert.equal(D.doorSearch('?ref=li&door=deep', 'short'), '?ref=li');
  assert.equal(D.doorSearch('?ref=li', 'deep'), '?ref=li&door=deep');
});
test('doorForHash maps sections to their door', () => {
  assert.equal(D.doorForHash('#machine-spec'), 'deep');
  assert.equal(D.doorForHash('#lab'), 'deep');
  assert.equal(D.doorForHash('#about'), 'short');
  assert.equal(D.doorForHash('#garden-invite'), 'short');
  assert.equal(D.doorForHash('#contact'), null);
  assert.equal(D.doorForHash(''), null);
});
test('clampZoom keeps 1..6', () => {
  assert.equal(D.clampZoom(0.2), 1);
  assert.equal(D.clampZoom(9), 6);
  assert.equal(D.clampZoom(2.5), 2.5);
});
test('zoomAt keeps the point under the cursor fixed', () => {
  const s0 = { s: 1, x: 0, y: 0 };
  const s1 = D.zoomAt(s0, 2, 100, 50);
  assert.equal(s1.s, 2);
  // screen point = x + s * imagePoint; imagePoint under (100,50) was (100,50) at s=1
  assert.equal(s1.x + 2 * 100, 100);
  assert.equal(s1.y + 2 * 50, 50);
});
test('zoomAt back to 1 recentres', () => {
  assert.deepEqual(D.zoomAt({ s: 2, x: -100, y: -40 }, 0.1, 0, 0), { s: 1, x: 0, y: 0 });
});
test('panBy stays inside the scaled image', () => {
  const b = { w: 800, h: 400, vw: 1000, vh: 800 };
  assert.deepEqual(D.panBy({ s: 1, x: 0, y: 0 }, 300, 300, b), { s: 1, x: 0, y: 0 });
  const p = D.panBy({ s: 2, x: 0, y: 0 }, 1000, -1000, b);
  assert.equal(p.x, 300);   // (1600-1000)/2
  assert.equal(p.y, 0);     // 800 <= 800, no room
});
```

- [ ] **Step 2:** Run `node --test tests/home-doors-logic.test.js`. Expected: FAIL with "Cannot find module '../home-doors-logic.js'".
- [ ] **Step 3: Implement `home-doors-logic.js`** with the signatures above. It uses `URLSearchParams` and has no DOM access.
- [ ] **Step 4:** Run `node --test 'tests/**/*.test.js'`. Expected: all pass (53 existing plus 8 new).
- [ ] **Step 5: Commit** `home-doors-logic.js tests/home-doors-logic.test.js` with the message "Add the door and chart-zoom logic for the front page".

---

### Task 2: Door switch, panels, and nav

**Files:**
- Create: `home-doors.js`
- Modify: `index.html` (hero subtitle area, the door switch, wrapping sections into panels, nav, script tags), `script.js` (subtitle text, garden-stats trigger), `style.css` (switch and panel styles)

**Interfaces:**
- Consumes: `HomeDoorsLogic.pickDoor`, `doorSearch` and `doorForHash` from Task 1.
- Produces:
  - Panel containers `<div class="door" data-door-panel="short|deep" hidden>`.
  - Buttons `[data-door]`. Any element with `data-door` switches doors when clicked, so the Task 3 nudge reuses this.
  - `window.HomeDoors.open(door: 'short'|'deep', opts {scroll?: boolean})`.
  - A `door:change` CustomEvent on `document` with `detail.door`.

- [ ] **Step 1: Restructure `index.html` without changing content yet.**
  - Under `.hero-card`, add the switch markup from the mock-up `doors-v2.html`:
    - a `card-led` "SELECT DEPTH";
    - `.door-buttons` with two `button.door-btn[data-door]` carrying `aria-pressed`;
    - `#doorHint`.
  - Wrap `#about` and `#experience` (with their dividers) in the short panel.
  - Wrap `#machine-spec`, `#skills`, `#projects` and `#knowledge-garden-showcase` in the deep panel.
  - Leave `#contact` and the footer outside both panels.
  - Nav: the "Skills" link becomes `href="#lab"` with the text "Lab". Task 4 creates `#lab`; until then point it at `#skills`.
  - Load `home-doors-logic.js` and `home-doors.js` (both `defer`) after `script.js`.
- [ ] **Step 2: Implement `home-doors.js`.**
  - On DOMContentLoaded it chooses the door from three inputs:
    - `doorForHash(location.hash)`, if that's non-null;
    - otherwise `pickDoor(location.search, storedDoor)`;
    - where `storedDoor` comes from `localStorage.getItem('home-door')` inside try/catch.
  - `open(door)` does five things:
    - sets the panels' `hidden`;
    - sets the buttons' `aria-pressed`;
    - sets the hint text:
      - short: `plain words, big numbers · 2 min read · <span class="nudge">the charts live in the deep end</span>`;
      - deep: `charts, specs, telemetry · bring coffee`;
    - stores the choice inside try/catch, then calls `history.replaceState(null, '', location.pathname + doorSearch(location.search, door) + location.hash)`;
    - dispatches `door:change`.
  - When a user clicks a door button, scroll so the switch is at the top. Use `behavior: 'auto'` under reduced motion.
  - Nav and hash links to a section in the closed door: intercept clicks on `a[href^="#"]` and handle `hashchange`. When `doorForHash` gives the other door, `open()` it first, then scroll to the target. On first load with a hash, scroll after opening.
- [ ] **Step 3: Update `script.js`.**
  - The typed subtitle becomes `i build and break my own servers, then write down what actually happened.`
  - Replace the IntersectionObserver gate on `#knowledge-garden-showcase` with a direct `updateGardenStats()` on DOMContentLoaded. Keep the 10-minute interval. This way the hero strip and both doors' counts fill whichever door is open (Review Focus 5).
  - In `handleIntersect`'s observer setup, re-run `checkElementsVisibility()` on `door:change`, so elements revealed late still animate in.
- [ ] **Step 4: Styles in `style.css`.** Port `.door-switch`, `.door-buttons`, `.door-btn` (including `[aria-pressed="true"]` and `:active` scale .95) and `.door-hint .nudge` from `doors-v2.html`, using spring tokens. Also add `[data-door-panel][hidden] { display: none; }`.
- [ ] **Step 5: Verify headlessly** with the scratchpad `cdp.mjs` harness against `http://localhost:8792/index.html`, checking all of the following:
  - default shows short; deep is `hidden`;
  - `?door=deep` shows deep; `?door=DEEP` shows short;
  - `#machine-spec` opens deep and the section is in view;
  - clicking Lab while in short opens deep;
  - after `localStorage.setItem = () => { throw new Error() }` is injected before load, switching still works;
  - `[garden: N]` fills within 10s with deep closed;
  - `scrollWidth === innerWidth` at 390 and 1440.

  Expected: each check prints `ok`.
- [ ] **Step 6:** Run `node --test 'tests/**/*.test.js'` (expected: all pass), then commit `index.html script.js style.css home-doors.js` with the message "Split the front page into a short version and a deep end".

---

### Task 3: The short version's content

**Files:**
- Modify: `index.html` (the short panel), `style.css`

**Interfaces:**
- Consumes: the `[data-door]` click behaviour from Task 2.
- Produces: `#garden-invite`, and `#noteCount2`/`#folderCount2` filled by `script.js`.

- [ ] **Step 1: Check the numbers.** Fetch the three notes from the spec §4 "Things I've Done" table from raw GitHub. Confirm each one states the figure it backs:
  - "62s" and "1s", or the equivalent;
  - "16.58%" (shown as 16.6%);
  - 40 questions with zero made-up quotations.

  Record the line found for each in the commit message body. If a figure is missing, reword the card to what the note says.
- [ ] **Step 2: "Hi there,"** Replace the epigraph, the paragraph and the four about cards with `.whoami`:
  - an optional `.whoami-photo` slot, rendered only when `data-photo` on `#about` is set; it's empty now;
  - and the paragraph, verbatim from spec §3.3.1.

  With no photo, the grid is a single column.
- [ ] **Step 3: "Things I've Done"**: a new `section.content-section#done` after About, containing a `.proof-grid` of three `spec-unit.proof-card`s. Each card uses the exact tag, number, title, line and note from spec §4, and the link text `[ read the story → ]`.
- [ ] **Step 4: Garden invite and nudge.**
  - After Experience add `section#garden-invite` titled "Where I Write It Down": one lowercase line, the counts in spans `#noteCount2`/`#folderCount2`, and a button to `garden-terminal.html`.
  - Update `updateGardenStats` in `script.js` to also fill `#noteCount2` and `#folderCount2`.
  - Then add the `.deep-nudge` `spec-unit` with the card-led "THAT WAS THE SHORT VERSION", the line from spec §3.3.5, and `button.door-btn[data-door="deep"]` with the text `[ open the deep end → ]`.
- [ ] **Step 5: Styles.** Add `.whoami`, `.proof-grid` (three columns using `minmax(0,1fr)`, one column at 760px and below), `.proof-num`, `.proof-link` and `.deep-nudge`, ported from the mock-up.
- [ ] **Step 6: Verify headlessly.**
  - Screenshot the short door at 1440 and 390.
  - Check that `#noteCount2` fills.
  - Check that the nudge button opens deep.
  - Check that the page has no horizontal overflow.
- [ ] **Step 7:** Run the tests, then commit `index.html style.css script.js` with the message "Write the short version: who i am, three results, and a nudge to the deep end".

---

### Task 4: The deep end's content

**Files:**
- Modify: `index.html` (the deep panel), `style.css`, `script.js` (remove the VU meter code)

**Interfaces:**
- Produces: `#lab`, and `.lab-card .chart` elements, each holding one `<img>` and carrying `data-note` (the note URL), for Task 5.

- [ ] **Step 1: Check the numbers.**
  - Lab Results (spec §4): check each headline against its note.
  - Receipts (spec §4): check each skill row against its note. The Operations row is checked against the Experience card text already in `index.html`.

  Reword anything that isn't stated.
- [ ] **Step 2: Lab Results.** Add `section#lab` titled "Lab Results" as the first section of the deep panel. It holds the five cards in spec order: card 1 is `.lab-card.wide`, the rest go in `.lab-grid`. Each card has:
  - a `card-led` tag;
  - `.chart` with `<img loading="lazy" decoding="async" alt="<one-line description of the chart>">`;
  - the src `https://raw.githubusercontent.com/AIMDaAlien/Obsidian-Vault/main/` plus the path URL-encoded per segment;
  - `.chart.dark` for the RTX 3060, pareto and gate charts;
  - `.lab-num`;
  - an optional `spec-line`;
  - `[ read the write-up → ]`.
- [ ] **Step 3: Skills, With Receipts.**
  - Replace the contents of `#skills` (title "Skills, With Receipts") with `ul.proof-list`, holding the rows from spec §4 in the form `span.skill`, `span` result, `a` link.
  - Delete all `.vu-meter` markup.
  - Delete the meter code in `script.js` around `const meters = document.querySelectorAll('.vu-meter')`.
  - Delete the `.vu-*` CSS rules, then grep to confirm none remain.
- [ ] **Step 4: Projects.**
  - Delete every `.complexity-meter` block and its "Complexity:" label from the project cards, along with the `.complexity-*` CSS.
  - Any project card without a write-up link gets one where a garden note exists: The Penthouse links to `01 Projects/Penthouse/00 - Knowledge Hub.md`, and Aim's 3D Print Shoppe keeps its external link.
- [ ] **Step 5: Styles.** Add `.lab-grid`, `.lab-card`, `.lab-card.wide`, `.lab-card .chart`, `.chart.dark`, `.lab-num` and `.proof-list`, ported from the mock-up. Use `minmax(0,…)` tracks and switch to a single column at 760px and below.
- [ ] **Step 6: Verify headlessly** with `?door=deep` at 1440 and 390:
  - all five images have `naturalWidth > 0`;
  - no `.vu-meter` or `.complexity-meter` remains in the DOM;
  - there are no console errors;
  - there's no overflow;
  - screenshots taken.
- [ ] **Step 7:** Run the tests, then commit `index.html style.css script.js` with the message "Fill the deep end: lab results from the vault, skills with receipts, no gauges".

---

### Task 5: Chart viewer

**Files:**
- Modify: `home-doors.js`, `index.html` (the dialog markup before `</main>`), `style.css`

**Interfaces:**
- Consumes: `HomeDoorsLogic.clampZoom`, `zoomAt` and `panBy` from Task 1, and the `.lab-card .chart` elements with `data-note` from Task 4.

- [ ] **Step 1: Markup.** Add `<div class="zoom" id="chartZoom" role="dialog" aria-modal="true" aria-label="chart viewer" hidden>`. It holds `img#chartZoomImg` and `.zoom-bar` with these buttons:
  - `−`, `+` and `fit`;
  - `a#chartZoomNote` with the text "read the write-up →";
  - `✕ close`.
- [ ] **Step 2: Behaviour in `home-doors.js`.**
  - Each `.chart` gets `tabindex="0"` and `role="button"`, with `aria-label="zoom chart: <alt>"`. Click or Enter/Space opens the viewer. Opening:
    - sets the image src and the note href from `data-note`;
    - resets the state to `{s:1,x:0,y:0}`;
    - sets `document.body.style.overflow = 'hidden'`;
    - focuses the close button.
  - **Zoom:**
    - The wheel calls `zoomAt(state, e.deltaY < 0 ? 1.15 : 1/1.15, px, py)`, where px and py are the pointer position relative to the image centre. Register the listener with `passive: false`.
    - The + and − buttons zoom by 1.4 about the centre. "fit" resets.
    - Double-click toggles between 1 and 2.5 about the pointer.
  - **Pointer events:**
    - One pointer drags through `panBy`.
    - Two pointers pinch: zoom by the ratio of their distances about their midpoint.
    - Set `touch-action: none` on `.zoom`.
  - **Closing:** Esc, ✕ or a backdrop click closes the viewer, restores body overflow and returns focus to the chart that opened it. Tab stays inside the dialog.
  - Apply the transform as `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${s})`.
- [ ] **Step 3: Missing image (Review Focus 4).** `img.onerror` on a lab chart adds `.chart--missing`. Hide the img and show `::after` content "chart unavailable · read the write-up" at the frame's min-height of 160px. Missing charts don't open the viewer.
- [ ] **Step 4: Styles.**
  - `.lab-card .chart img { opacity: .9 }`, rising to 1 on `:hover`/`:focus-visible`.
  - The "⤢ zoom" tag appears on hover or focus.
  - Add `.zoom`, `.zoom img` and `.zoom-bar` from the mock-up.
  - A reduced-motion block removes the transitions.
- [ ] **Step 5: Verify headlessly** with `?door=deep`:
  - Click chart 2; the dialog is visible and the body overflow is hidden.
  - Dispatch wheel-ups at a point off-centre; the scale is greater than 1, and the image point under the cursor moves by 2px or less (computed from the transform).
  - Drag; x changes and stays within bounds.
  - Esc closes it, and `document.activeElement` is the chart.
  - Load with one chart's src set to a bogus path; the "chart unavailable" text is visible.

  Expected: each check prints `ok`.
- [ ] **Step 6:** Run the tests, then commit `index.html style.css home-doors.js` with the message "Let every lab chart open full-screen with zoom, pinch and pan".

---

### Task 6: Finish

**Files:**
- Modify: `AGENTS.md` (git-ignored; local edit only)

- [ ] **Step 1:** Add `home-doors-logic.js` and `home-doors.js` to the AGENTS.md file list, with one line each.
- [ ] **Step 2: Full headless pass** at 1440 and 390:
  - both doors; `?door=deep`; `#lab` from short; the nudge;
  - reduced motion (emulate `prefers-reduced-motion: reduce`, and the switch still works);
  - no console errors; no overflow.

  Save screenshots for the owner: `two-doors-short-desktop.png`, `two-doors-deep-desktop.png`, `two-doors-short-phone.png`, `two-doors-deep-phone.png` and `two-doors-zoom.png`.
- [ ] **Step 3:** Run `node --test 'tests/**/*.test.js'`. Expected: all pass.
- [ ] **Step 4:** Do not push. Send the owner the screenshots and ask for consent to merge `two-doors` into main and push.
