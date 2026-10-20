# Knowledge Garden Reader Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Knowledge Garden page a default reader mode (topics, summary cards, note headers, resolved wikilinks) while keeping the existing terminal mode intact one keystroke away.

**Architecture:** A new pure-logic file (`garden-reader-logic.js`) holds every testable decision: topic mapping, title index, wikilink rewriting, related-note selection, search, reading time, snippets, listability. A new DOM layer (`garden-reader.js`) renders reader mode on top of the existing `KnowledgeGarden` instance, which gains four small hooks. `body[data-mode]` drives two stylesheets. The compose pipeline in the public vault repo learns one new curation key, `blurb`.

**Tech Stack:** Vanilla HTML/CSS/JS, `marked@12` already loaded by the page, `node --test` (Node 22) for unit tests, Python 3.12 `unittest` for the compose change.

**Spec:** `docs/superpowers/specs/2026-10-20-garden-reader-design.md`

## Global Constraints

- No build step, no npm dependencies, no frameworks, no preprocessors (AGENTS.md §6, §9). Pure logic files export via `if (typeof module !== 'undefined') module.exports = …` and also attach to `window`.
- Colors, shape, motion, and type come from `m3e-tokens.css` tokens. Cards use `var(--md-sys-shape-corner-extra-large)` (28px). Interactive transitions use `var(--motion-spring-bouncy)` / `var(--motion-spring-expressive)`; `cubic-bezier` is forbidden. Brand font Ubuntu, code JetBrains Mono.
- Mode stored in `localStorage` key `garden-mode`, values `reader` | `terminal`, default `reader`. `body` carries `data-mode` with the same value.
- Hint bar text is exactly: ``press ` for the terminal``. Backtick toggles only when the event target is not an input, textarea, select, or contenteditable element.
- Featured strip = `publish: true` notes with integer `featured` 1..10, capped at 10 (`featuredLimit` already 10). `summary` ≤ 160 chars, `blurb` ≤ 400 chars; both optional everywhere.
- Reader mode shows only `publish: true` notes. Hidden in both modes: any path segment in `hiddenItems`, any segment starting with `.`, `_attachments`, `00 Index`, and root-level files `Index.md`, `README.md`, `Redaction Conventions.md`, `markdown practice.md`.
- Reading time = `Math.max(1, Math.ceil(words / 200))` minutes. Snippets truncate at a word boundary ≤ 160 chars with a trailing `…`.
- Deep links use `?note=<encodeURIComponent(path)>`; in-page note links use the same `href` plus `data-note="<path>"`.
- Portfolio commits on `main` (owner consent given 2026-10-18 for this repo); public-repo change on a branch in a scratchpad clone, author `AIMDaAlien <AIMDaAlien@users.noreply.github.com>`, pushed only after the controller asks the owner.
- Nothing personal in any file: no LAN IPs, no names beyond the owner's handle.

## Review Focus

1. Wikilinks inside fenced code blocks or inline code must be left untouched; rewriting them corrupts code samples. Pinned in Task 1.
2. Pressing backtick while typing in the search box or the terminal input must not switch modes. Pinned in Task 4 (`isTypingTarget`).
3. Note paths containing `&`, `#`, `%`, or `+` must round-trip through `?note=` deep links and in-page links. Pinned in Task 1 (`noteHref` / `notePathFromSearch`).
4. A topic with zero published notes must render a "No published notes here yet" line, not an empty page. Pinned in Task 2 (`groupByTopic`) and Task 5.
5. A note with a `featured` rank but `publish: false`, or a hidden path, must never appear in the strip, topic pages, search, or related lists. Pinned in Task 2 (`relatedNotes`, `filterNotes`) and Task 3 (`isListable`).

---

## File Structure

| File | Responsibility |
|---|---|
| `garden-reader-logic.js` (new) | Pure functions, no DOM: topics, title index, wikilinks, related, search, reading time, snippets, listability, mode helpers. |
| `garden-reader.js` (new) | `GardenReader` class: mode switch, hint bar, reader sidebar, landing, topic pages, cards, lazy snippets, note header, related cards. |
| `garden-reader.css` (new) | Styles scoped to `body[data-mode="reader"]` and `.terminal-hint`. |
| `tests/garden-reader.test.js` (new) | `node --test` suite for the logic file. |
| `garden-terminal.js` (modify) | Hooks: markdown preprocessor registry, `viewFileByPath(path, { headerHtml, afterHtml })`, listability filter in tree, `exit` command, reader button, mode-aware init, fallback card removal. |
| `garden-terminal.html` (modify) | `data-mode` on body, hint bar, reader sidebar container, reader button, new script/style tags, fallback card removed. |
| `script.js` (modify) | Featured count clip 6 → 10. |
| `AGENTS.md` (modify) | §7 `exit`, modes note; §6 file list. |
| Public repo `.github/scripts/composelib/notes.py`, `tests/test_compose_notes.py`, `.github/unraid/curation.yml` | `blurb` curation key. |

---

### Task 1: Reader logic — topics, title index, wikilinks, deep-link paths

**Files:**
- Create: `garden-reader-logic.js`
- Create: `tests/garden-reader.test.js`

**Interfaces:**
- Produces (all on `GardenReaderLogic`, also `module.exports`):
  - `TOPICS: Array<{ id: string, label: string, description: string, folders: string[] }>` in the spec's order with ids `projects`, `homelab`, `ai`, `linux`, `journals`, `tools`; `linux.folders = ['05 Linux and Systems', '04 Programming']`.
  - `topicForPath(path: string): Topic | null`
  - `buildTitleIndex(metadata: Record<string, object>): Map<string, string>` — keys are lowercased filename stem and lowercased `title`; only `publish === true` and listable paths; collisions resolved by lower integer `featured` then lexically smaller path.
  - `resolveWikilink(target: string, index: Map): string | null` — strips `#heading` and `|alias`, lowercases, trims.
  - `rewriteWikilinks(markdown: string, index: Map): string` — `[[X]]`, `[[X|A]]`, `[[X#h]]`, `[[X#h|A]]` → `[A or X](?note=<enc>)` when resolved, else the display text; skips fenced code blocks and inline code spans.
  - `noteHref(path: string): string` → `?note=` + `encodeURIComponent(path)`.
  - `notePathFromSearch(search: string): string | null` — reads `note` from a query string.

- [ ] **Step 1: Write the failing tests**

```js
// tests/garden-reader.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../garden-reader-logic.js');

const META = {
  '01 Projects/Penthouse/00 - Knowledge Hub.md': { publish: true, featured: 1, title: 'The Penthouse Rebuild Knowledge Hub', summary: 'Map of the rebuild', tags: ['penthouse'], updated: '2026-10-12' },
  '02 Homelab/Guides/TrueNAS Build Guide.md': { publish: true, featured: 4, title: 'TrueNAS Build Guide', summary: 'Budget SAS NAS', tags: ['truenas'], updated: '2026-10-17' },
  '03 AI and Local Models/Benchmarks/Strata V100.md': { publish: true, featured: 7, title: 'Strata V100 setup and benchmarks', machine: 'bigrig', updated: '2026-10-12' },
  '04 Programming/Regex.md': { publish: true, title: 'Regex', updated: '2026-01-01' },
  '05 Linux and Systems/Shell/Pipes.md': { publish: true, title: 'Pipes', updated: '2026-02-01' },
  '05 Linux and Systems/Shell/Dupe.md': { publish: true, title: 'Pipes', featured: 50, updated: '2026-02-02' },
  '07 Tools and Workflow/Obsidian Vault Git Sync.md': { publish: false, featured: 77, title: 'Obsidian Vault Git Sync' },
  '_attachments/x.md': { publish: true, title: 'Hidden' },
  'README.md': { publish: true, title: 'README' },
};

test('TOPICS order and the Programming fold', () => {
  assert.deepEqual(L.TOPICS.map(t => t.id), ['projects', 'homelab', 'ai', 'linux', 'journals', 'tools']);
  assert.deepEqual(L.TOPICS.find(t => t.id === 'linux').folders, ['05 Linux and Systems', '04 Programming']);
});

test('topicForPath maps folders and returns null for unknown or hidden', () => {
  assert.equal(L.topicForPath('04 Programming/Regex.md').id, 'linux');
  assert.equal(L.topicForPath('02 Homelab/Guides/TrueNAS Build Guide.md').id, 'homelab');
  assert.equal(L.topicForPath('00 Index/Projects Index.md'), null);
  assert.equal(L.topicForPath('README.md'), null);
});

test('buildTitleIndex keys stem and title, skips unpublished and hidden, resolves collisions by rank', () => {
  const idx = L.buildTitleIndex(META);
  assert.equal(idx.get('00 - knowledge hub'), '01 Projects/Penthouse/00 - Knowledge Hub.md');
  assert.equal(idx.get('the penthouse rebuild knowledge hub'), '01 Projects/Penthouse/00 - Knowledge Hub.md');
  assert.equal(idx.get('pipes'), '05 Linux and Systems/Shell/Dupe.md'); // featured 50 beats unranked
  assert.equal(idx.has('obsidian vault git sync'), false);
  assert.equal(idx.has('hidden'), false);
  assert.equal(idx.has('readme'), false);
});

test('resolveWikilink strips heading and alias', () => {
  const idx = L.buildTitleIndex(META);
  assert.equal(L.resolveWikilink('TrueNAS Build Guide#Parts|the guide', idx), '02 Homelab/Guides/TrueNAS Build Guide.md');
  assert.equal(L.resolveWikilink('Nope', idx), null);
});

test('rewriteWikilinks rewrites resolved, flattens unresolved, skips code', () => {
  const idx = L.buildTitleIndex(META);
  const md = 'See [[TrueNAS Build Guide|the guide]] and [[Nope#x|gone]].\n```\n[[TrueNAS Build Guide]]\n```\nInline `[[Pipes]]` stays.';
  const out = L.rewriteWikilinks(md, idx);
  assert.match(out, /\[the guide\]\(\?note=02%20Homelab%2FGuides%2FTrueNAS%20Build%20Guide\.md\)/);
  assert.match(out, /and gone\./);
  assert.match(out, /```\n\[\[TrueNAS Build Guide\]\]\n```/);
  assert.match(out, /`\[\[Pipes\]\]`/);
});

test('noteHref and notePathFromSearch round-trip awkward characters', () => {
  const p = '01 Projects/A & B/C#1 100%.md';
  assert.equal(L.notePathFromSearch(L.noteHref(p)), p);
  assert.equal(L.notePathFromSearch('?x=1'), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL, `Cannot find module '../garden-reader-logic.js'`

- [ ] **Step 3: Implement `garden-reader-logic.js`**

Define `HIDDEN_SEGMENTS = ['.obsidian', '.stfolder', '.DS_Store', '.gitignore', '.github', 'Myself', 'images', '_attachments', '00 Index']` and `HIDDEN_ROOT_FILES = ['Index.md', 'README.md', 'Redaction Conventions.md', 'markdown practice.md']`, plus `isListable(path, meta)` (used by Task 3) returning false for unpublished, hidden segments, dot segments, and root files in the list. Implement the six functions above. For `rewriteWikilinks`, split the markdown on fenced blocks (```` ``` ```` lines) and inline code spans (single backticks) and only rewrite the non-code segments; the regex for a link is `/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g`. Export with `const GardenReaderLogic = {...}; if (typeof module !== 'undefined') module.exports = GardenReaderLogic; if (typeof window !== 'undefined') window.GardenReaderLogic = GardenReaderLogic;`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/`
Expected: 6 passing

- [ ] **Step 5: Commit**

```bash
git add garden-reader-logic.js tests/garden-reader.test.js
git commit -m "Add reader logic: topics, title index, wikilink rewriting"
```

---

### Task 2: Reader logic — related notes, search, reading time, snippets, grouping

**Files:**
- Modify: `garden-reader-logic.js`
- Modify: `tests/garden-reader.test.js`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces:
  - `relatedNotes(path, metadata, links, index, limit = 5): { outgoing: string[], incoming: string[] }` — `links` is the manifest map `{ [path]: string[] of link targets }`; targets resolve through `index`; only listable `publish: true` paths; never includes `path` itself; outgoing in manifest order, incoming sorted by lower `featured` then `updated` desc.
  - `filterNotes(query: string, entries: Array<{ path, title, summary, tags }>): entries` — case-insensitive substring over title, summary, and tags; empty or whitespace query returns all.
  - `readingTime(text: string): number`
  - `snippetFromMarkdown(markdown: string, max = 160): string` — drops frontmatter, headings, code fences, image embeds, and wikilink brackets; first non-empty paragraph; word-boundary truncation with `…`.
  - `groupByTopic(metadata): Map<topicId, { ranked: Entry[], unranked: Entry[] }>` — every topic id present even when empty; `Entry = { path, title, summary, blurb, tags, featured, updated, created, machine }`; ranked sorted by `featured` asc; unranked by `updated` desc then title.
  - `featuredStrip(metadata, limit = 10): Entry[]` — ranks 1..limit, sorted.

- [ ] **Step 1: Write the failing tests** (append to the test file)

```js
test('relatedNotes resolves both directions, drops unpublished and self, caps at limit', () => {
  const idx = L.buildTitleIndex(META);
  const links = {
    '01 Projects/Penthouse/00 - Knowledge Hub.md': ['TrueNAS Build Guide', 'Obsidian Vault Git Sync', 'Nope', '00 - Knowledge Hub'],
    '02 Homelab/Guides/TrueNAS Build Guide.md': ['The Penthouse Rebuild Knowledge Hub'],
    '04 Programming/Regex.md': ['00 - Knowledge Hub'],
    '07 Tools and Workflow/Obsidian Vault Git Sync.md': ['00 - Knowledge Hub'],
  };
  const r = L.relatedNotes('01 Projects/Penthouse/00 - Knowledge Hub.md', META, links, idx, 5);
  assert.deepEqual(r.outgoing, ['02 Homelab/Guides/TrueNAS Build Guide.md']);
  assert.deepEqual(r.incoming, ['02 Homelab/Guides/TrueNAS Build Guide.md', '04 Programming/Regex.md']);
  assert.deepEqual(L.relatedNotes('01 Projects/Penthouse/00 - Knowledge Hub.md', META, links, idx, 1).incoming, ['02 Homelab/Guides/TrueNAS Build Guide.md']);
});

test('filterNotes matches title, summary, tags; blank query returns all', () => {
  const entries = L.featuredStrip(META);
  assert.equal(L.filterNotes('  ', entries).length, entries.length);
  assert.deepEqual(L.filterNotes('sas', entries).map(e => e.path), ['02 Homelab/Guides/TrueNAS Build Guide.md']);
  assert.deepEqual(L.filterNotes('PENTHOUSE', entries).map(e => e.path), ['01 Projects/Penthouse/00 - Knowledge Hub.md']);
});

test('readingTime rounds up and floors at one minute', () => {
  assert.equal(L.readingTime('one two three'), 1);
  assert.equal(L.readingTime(Array(401).fill('w').join(' ')), 3);
});

test('snippetFromMarkdown takes the first paragraph, strips noise, truncates on a word', () => {
  const md = '---\ntitle: x\n---\n# Heading\n![[img.png]]\n\nThis is the **first** paragraph with a [[Wiki Link|link]] inside. ' + 'word '.repeat(60);
  const s = L.snippetFromMarkdown(md, 60);
  assert.ok(s.startsWith('This is the first paragraph with a link inside.'));
  assert.ok(s.endsWith('…'));
  assert.ok(s.length <= 61);
  assert.equal(L.snippetFromMarkdown('```\ncode\n```\n'), '');
});

test('groupByTopic lists every topic, orders ranked then unranked, excludes unpublished', () => {
  const g = L.groupByTopic(META);
  assert.deepEqual([...g.keys()], ['projects', 'homelab', 'ai', 'linux', 'journals', 'tools']);
  assert.deepEqual(g.get('linux').ranked.map(e => e.path), ['05 Linux and Systems/Shell/Dupe.md']);
  assert.deepEqual(g.get('linux').unranked.map(e => e.path), ['05 Linux and Systems/Shell/Pipes.md', '04 Programming/Regex.md']);
  assert.deepEqual(g.get('journals'), { ranked: [], unranked: [] });
  assert.deepEqual(g.get('tools'), { ranked: [], unranked: [] });
});

test('featuredStrip returns ranks 1..limit sorted and ignores unpublished', () => {
  assert.deepEqual(L.featuredStrip(META, 10).map(e => e.featured), [1, 4, 7]);
  assert.deepEqual(L.featuredStrip(META, 5).map(e => e.featured), [1, 4]);
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `node --test tests/`
Expected: 6 pass, 6 fail with `is not a function`

- [ ] **Step 3: Implement the six functions in `garden-reader-logic.js`**

Add a shared `toEntry(path, meta)` helper that builds `Entry` with `title` falling back to the filename stem. `groupByTopic` and `featuredStrip` both filter through `isListable`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/`
Expected: 12 passing

- [ ] **Step 5: Commit**

```bash
git add garden-reader-logic.js tests/garden-reader.test.js
git commit -m "Add reader logic: related notes, search, snippets, grouping"
```

---

### Task 3: Terminal hooks and listing cleanup

**Files:**
- Modify: `garden-terminal.js` (`renderMarkdown` ~1180, `viewFileByPath` ~953, `buildTreeFromManifest` ~256, `loadFeaturedFromManifest` ~568, `loadCardGallery` ~2131, `executeCommand` help/switch ~1498–1680, command lists at ~1329 and ~2006, `showWelcome` ~1107, `init` ~77)
- Modify: `garden-terminal.html` (fallback card inside `#featuredNotes`, terminal title bar, script tags)
- Modify: `script.js` (~517, the `Math.min(featuredCount, 6)`)
- Modify: `AGENTS.md` §7 table (add `exit`)

**Interfaces:**
- Consumes: `GardenReaderLogic.isListable(path, meta)`, `GardenReaderLogic.rewriteWikilinks`.
- Produces on `KnowledgeGarden`:
  - `registerMarkdownPreprocessor(fn: (markdown: string) => string): void` — `renderMarkdown` runs registered functions in order after stripping frontmatter and before `marked.parse`.
  - `viewFileByPath(path, { headerHtml = '', afterHtml = '' } = {})` — inserts `headerHtml` before the metadata bar and `afterHtml` after the body; when `headerHtml` is non-empty the old metadata bar is omitted (the header carries the dates). On a fetch error `headerHtml` is still rendered above the existing error block (spec §8).
  - `onNoteOpened: ((path: string) => void) | null` — called at the end of a successful `viewFileByPath`.
  - `requestMode: ((mode: 'reader'|'terminal') => void) | null` — set by the reader; the `exit` command and the reader button call `this.requestMode?.('reader')`.
  - Tree, featured, and gallery lists pass every path through `GardenReaderLogic.isListable(path, manifest.metadata[path])` when the logic file is loaded, falling back to the existing `isHiddenPath` when it is not.
  - `init()` no longer renders the welcome featured strip when `document.body.dataset.mode === 'reader'`; it still loads the manifest and the tree.

- [ ] **Step 1: Add the `exit` + listability unit test**

Append to `tests/garden-reader.test.js`:

```js
test('isListable hides unpublished, dot and hidden segments, and root housekeeping files', () => {
  assert.equal(L.isListable('01 Projects/Penthouse/00 - Knowledge Hub.md', META['01 Projects/Penthouse/00 - Knowledge Hub.md']), true);
  assert.equal(L.isListable('07 Tools and Workflow/Obsidian Vault Git Sync.md', META['07 Tools and Workflow/Obsidian Vault Git Sync.md']), false);
  assert.equal(L.isListable('_attachments/x.md', META['_attachments/x.md']), false);
  assert.equal(L.isListable('README.md', META['README.md']), false);
  assert.equal(L.isListable('markdown practice.md', { publish: true }), false);
  assert.equal(L.isListable('00 Index/Projects Index.md', { publish: true }), false);
  assert.equal(L.isListable('.obsidian/app.json', { publish: true }), false);
  assert.equal(L.isListable('02 Homelab/Homelab Index.md', undefined), false);
});
```

Run: `node --test tests/` — expected: 13 passing (function exists from Task 1; this pins the root-file and undefined-meta cases). If any assertion fails, fix `isListable` first.

- [ ] **Step 2: Add the hooks to `garden-terminal.js`**

Implement the Interfaces block. In `buildTreeFromManifest`, folders stay visible only if at least one listable descendant exists (compute once per manifest in `_buildParentIndex`). Add `case 'exit':` to the switch (`this.requestMode ? this.requestMode('reader') : this.showOutput('<span class="muted">Reader mode is not loaded.</span>')`), to both command arrays, and to the help text under **System:** as `exit                 Back to reader mode`.

- [ ] **Step 3: HTML, script.js, AGENTS.md**

In `garden-terminal.html`: delete the hard-coded fallback `<button class="note-card" …Prometheus…>` so `#featuredNotes` is empty; add `<button class="terminal-btn" id="terminalReader" title="Reader mode" aria-label="Switch to reader mode">⇤</button>` before the minimise button; add `<script src="garden-reader-logic.js"></script>` before `garden-terminal.js`. In `init()`, wire `#terminalReader` to `this.requestMode?.('reader')`. In `script.js` change `Math.min(featuredCount, 6)` to `Math.min(featuredCount, 10)`. In `AGENTS.md` §7 add the row `| exit | Return to reader mode |`.

- [ ] **Step 4: Verify terminal mode is unchanged by hand**

Run: `python3 -m http.server 8792 --bind 127.0.0.1` from the repo root and open `http://127.0.0.1:8792/garden-terminal.html` in the owner's browser (`open http://127.0.0.1:8792/garden-terminal.html`).
Expected: page loads as before; the tree no longer shows `_attachments`, `00 Index`, `Index`, `README`, `Redaction Conventions`, `markdown practice`; `help` lists `exit`; `exit` prints "Reader mode is not loaded."; opening a note still works; no console errors.

- [ ] **Step 5: Commit**

```bash
git add garden-terminal.js garden-terminal.html script.js AGENTS.md tests/garden-reader.test.js garden-reader-logic.js
git commit -m "Add reader hooks to the terminal and hide housekeeping paths"
```

---

### Task 4: Mode switch, hint bar, and stylesheet skeleton

**Files:**
- Create: `garden-reader.js`
- Create: `garden-reader.css`
- Modify: `garden-terminal.html` (body attribute, hint bar, reader sidebar container, tags)
- Modify: `garden-reader-logic.js`, `tests/garden-reader.test.js` (mode helpers)
- Modify: `AGENTS.md` §6 file list, §7 modes note

**Interfaces:**
- Consumes: `window.garden` (`KnowledgeGarden`), `requestMode`, `GardenReaderLogic`.
- Produces:
  - Logic: `readStoredMode(storage): 'reader'|'terminal'` — `storage.getItem('garden-mode')` when `reader`/`terminal`, else `reader`; a throwing `getItem` also yields `reader`; `isTypingTarget(el: { tagName?: string, isContentEditable?: boolean } | null): boolean`.
  - `class GardenReader { constructor(garden); init(); setMode(mode); get mode }` on `window.reader`.
  - `body[data-mode]` set synchronously by an inline script in `<head>` from `localStorage` before any stylesheet applies, so there is no flash.

- [ ] **Step 1: Write the failing tests** (append)

```js
test('readStoredMode defaults to reader and accepts only known values', () => {
  const store = (v) => ({ getItem: () => v });
  assert.equal(L.readStoredMode(store(null)), 'reader');
  assert.equal(L.readStoredMode(store('terminal')), 'terminal');
  assert.equal(L.readStoredMode(store('bogus')), 'reader');
  assert.equal(L.readStoredMode({ getItem() { throw new Error('blocked'); } }), 'reader');
});

test('isTypingTarget is true for inputs, textareas, selects, contenteditable', () => {
  assert.equal(L.isTypingTarget({ tagName: 'INPUT' }), true);
  assert.equal(L.isTypingTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(L.isTypingTarget({ tagName: 'SELECT' }), true);
  assert.equal(L.isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(L.isTypingTarget({ tagName: 'DIV' }), false);
  assert.equal(L.isTypingTarget(null), false);
});
```

Run: `node --test tests/` — expected: 2 new failures.

- [ ] **Step 2: Implement the two logic helpers; rerun** — expected 15 passing.

- [ ] **Step 3: Markup**

In `garden-terminal.html`: add to `<head>` before stylesheets
`<script>try{var m=localStorage.getItem('garden-mode');document.documentElement.dataset.mode=(m==='terminal'||m==='reader')?m:'reader';}catch(e){document.documentElement.dataset.mode='reader';}</script>` and have the stylesheets key off `html[data-mode]` (mirror to `body.dataset.mode` in `GardenReader.init`). Add `<link rel="stylesheet" href="garden-reader.css">` after the terminal stylesheet. Add inside `.app-container`, after the terminal `<aside>`: `<button type="button" class="terminal-hint" id="terminalHint" aria-label="Open the terminal"><span class="terminal-hint-glyph" aria-hidden="true">❯</span> press ` for the terminal</button>`. Add inside `.sidebar` after `.sidebar-header`: `<nav class="topic-list" id="topicList" aria-label="Topics"></nav>`. Add `<script src="garden-reader.js"></script>` after `garden-graph.js`.

- [ ] **Step 4: `garden-reader.css`**

Rules: `html[data-mode="reader"] .floating-terminal, html[data-mode="reader"] .status-bar, html[data-mode="reader"] .file-tree, html[data-mode="reader"] .sidebar-footer { display: none }`; `html[data-mode="terminal"] .terminal-hint, html[data-mode="terminal"] .topic-list { display: none }`; `.terminal-hint` fixed bottom-right, JetBrains Mono, `surface-container-high`, `corner-full`, `elevation-2`, hover lift per AGENTS.md §5 with `--motion-spring-bouncy`; at `max-width: 768px` the hint moves into the sidebar drawer footer (`position: static; width: 100%`). Leave card/landing/header rules for Tasks 5 and 6.

- [ ] **Step 5: `garden-reader.js` skeleton**

`GardenReader` with `init()`: mirror mode to `body`, bind `#terminalHint` click and the backtick keydown (ignore when `isTypingTarget(e.target)`), set `garden.requestMode = (m) => this.setMode(m)`. `setMode(mode)`: write `localStorage`, set `html` and `body` `data-mode`, on entering terminal focus `#terminalInput`, on entering reader call `this.renderHome()` only when no note is open (`garden.currentFile === null`); keep the open note otherwise. `renderHome()` is a stub for Task 5 that writes `<h1>Knowledge Garden</h1>` into `#contentBody`. Instantiate at the bottom: `window.reader = new GardenReader(window.garden); window.reader.init();`. Record in the `KnowledgeGarden.init()` deep-link branch: when `?note=` is present, do nothing extra here (Task 6 adds the header path).

- [ ] **Step 6: Verify by hand**

Serve and open the page. Expected: first load in reader mode shows no terminal, no status bar, no tree, the hint bar bottom-right; backtick switches to terminal mode (full existing UI, prompt focused); `exit` and the ⇤ button return; reload keeps the last mode; typing a backtick inside the terminal input does not toggle; at 390px width the hint sits in the drawer. `AGENTS.md` §6 lists the three new files; §7 gets one paragraph: reader mode default, backtick / `exit` to switch, key `garden-mode`.

- [ ] **Step 7: Commit**

```bash
git add garden-reader.js garden-reader.css garden-terminal.html garden-reader-logic.js tests/garden-reader.test.js AGENTS.md
git commit -m "Add reader mode switch and terminal hint bar"
```

---

### Task 5: Landing view, topics sidebar, topic pages, cards, search, lazy snippets

**Files:**
- Modify: `garden-reader.js`, `garden-reader.css`

**Interfaces:**
- Consumes: `featuredStrip`, `groupByTopic`, `filterNotes`, `snippetFromMarkdown`, `noteHref`, `TOPICS`; `garden.fetchManifest()`, `garden.fetchNote(path)`, `garden.escapeHtml`, `garden.parseDate`, `garden.getProjectColor(path)`.
- Produces on `GardenReader`: `renderHome()`, `renderTopic(topicId)`, `renderSidebar()`, `renderCard(entry): string`, `observeSnippets(container)`; `garden.viewFileByPath` is called on card click (delegated on `.reader-card[data-note]`).

- [ ] **Step 1: Sidebar and landing**

`renderSidebar()` fills `#topicList` with one button per topic: label, count (`ranked.length + unranked.length`), `aria-current="page"` on the active one, plus a "Home" button first. `renderHome()`: intro sentence `A working notebook from my homelab, my projects, and the models I run on my own hardware. Start with the featured notes, or pick a topic.`; `<input type="search" id="readerSearch" placeholder="Search titles, summaries, tags">`; `<section class="reader-featured">` with the strip cards; `<section class="reader-topics">` with one card per topic (label, description, count) that calls `renderTopic`. Search filters across all listable entries (ranked and unranked from `groupByTopic`) with a 150 ms debounce and replaces the two sections with a single result grid; clearing restores them. Set breadcrumb to `Home` and `garden.currentFile = null`. If `garden.fetchManifest()` rejects, render `<div class="error-content"><h2>Couldn't load the garden</h2><p class="muted">{garden.getFriendlyError(err, 'manifest')}</p><button type="button" id="readerRetry">Try again</button></div>` and wire the button to `renderHome()` (spec §8).

- [ ] **Step 2: Cards**

`renderCard(entry)` → `<article class="reader-card" data-note="<path>" style="--card-accent: <color>" tabindex="0" role="link">` with `.reader-card-topic` (topic label), `.reader-card-title`, `.reader-card-summary` (summary, or empty with `data-needs-snippet` when absent), `.reader-card-date` (`Updated Oct 17, 2026` via `parseDate`). Keyboard: Enter/Space opens. `observeSnippets(container)` uses an `IntersectionObserver` to fetch the note and fill `snippetFromMarkdown` for `[data-needs-snippet]` cards once; on fetch error remove the attribute and leave the card without text.

- [ ] **Step 3: Topic page**

`renderTopic(id)`: heading with label and description, ranked cards, `<hr class="reader-divider" data-label="More notes">` then unranked cards; when both lists are empty render `<p class="muted">No published notes here yet.</p>`. Breadcrumb `Home › <Label>`.

- [ ] **Step 4: Styles**

Grid `repeat(auto-fill, minmax(260px, 1fr))`, gap 16px, cards `surface-container`, 28px radius, lift on hover, squeeze on active, accent as a 4px left border; search field full width, `corner-full`; phone width stacks to one column with 16px gutters.

- [ ] **Step 5: Verify by hand**

Expected: landing shows ten featured cards with summaries, six topic cards with counts matching the sidebar; "Learning journals" and others open; search for `pareto` finds the V100 note; clearing restores; unranked cards fill in a snippet as they scroll into view; no topic page is blank; phone width single column, drawer lists topics.

- [ ] **Step 6: Commit**

```bash
git add garden-reader.js garden-reader.css
git commit -m "Add reader landing, topics, cards, and search"
```

---

### Task 6: Note header, blurb box, wikilinks, related notes, breadcrumb

**Files:**
- Modify: `garden-reader.js`, `garden-reader.css`, `garden-terminal.js` (deep-link branch in `init`, ~181)

**Interfaces:**
- Consumes: `rewriteWikilinks`, `buildTitleIndex`, `relatedNotes`, `readingTime`, `topicForPath`, `notePathFromSearch`; `garden.registerMarkdownPreprocessor`, `garden.viewFileByPath(path, { headerHtml, afterHtml })`, `garden.onNoteOpened`.
- Produces: `GardenReader.openNote(path)`, `renderHeader(path, meta, text): string`, `renderRelated(path): string`; the title index is rebuilt in `garden.applyFreshManifest` via a `garden.onManifestApplied` callback added in this task (one line in `applyFreshManifest`: `this.onManifestApplied?.(manifest)`).

- [ ] **Step 1: Preprocessor and index**

In `init()`, after the manifest loads: `this.index = buildTitleIndex(manifest.metadata)`; `garden.registerMarkdownPreprocessor(md => rewriteWikilinks(md, this.index))`; `garden.onManifestApplied = (m) => { this.index = buildTitleIndex(m.metadata); }`. Delegate clicks on `a[data-note]` and on `a[href^="?note="]` inside `#contentBody` to `openNote(decoded path)` with `preventDefault`, and push `?note=` into history with `history.pushState` so the back button works; handle `popstate` by opening `notePathFromSearch(location.search)` or home.

- [ ] **Step 2: Header and related**

`openNote(path)`: in reader mode fetch the note text (`garden.fetchNote`) to compute reading time, build `headerHtml = renderHeader(...)` and `afterHtml = renderRelated(path)`, then `garden.viewFileByPath(path, { headerHtml, afterHtml })`; in terminal mode call `garden.viewFileByPath(path)` unchanged. `renderHeader` → `<header class="note-header">`: topic chip (links to topic), `<h1>`, meta row with origin (`written on BigRig` / `on the Mac` / nothing), `Created …`, `Updated …`, `N min read`; `<p class="note-lede">summary</p>` when present; `<aside class="note-blurb"><h2>In plain terms</h2><p>blurb</p></aside>` when present. `renderRelated` → `<section class="note-related">` with "Links to" and "Linked from" lists of `renderCard` entries, each omitted when empty, whole section omitted when both are. Breadcrumb `Home › <Topic> › <Title>` in reader mode (terminal mode unchanged). Set `garden.onNoteOpened = () => window.scrollTo(0, 0)`.

- [ ] **Step 3: Deep links**

Replace the `init()` deep-link branch in `garden-terminal.js` with `this.onDeepLink ? this.onDeepLink(deepNote) : this.viewFileByPath(deepNote)`; the reader sets `garden.onDeepLink = (p) => this.openNote(p)`. The `?note=` path is parsed with `notePathFromSearch`.

- [ ] **Step 4: Styles**

`.note-header` with 32px top space, chip as `secondary-container` pill, meta row in `on-surface-variant` Label Large, lede in Title Large weight 400, `.note-blurb` as `primary-container` panel with 28px radius and `on-primary-container` text; `.note-related` grid reuses `.reader-card`; the terminal-mode metadata bar is unchanged.

- [ ] **Step 5: Verify by hand**

Expected: opening the Penthouse hub shows topic chip, title, dates, read time, lede, no blurb box (none written yet); a note with `[[links]]` shows them as links that open in place and resolve to BigRig notes where applicable; unresolved links show plain text; related section lists linked notes with summaries; back button returns; `?note=` URL pasted fresh opens the note in reader mode with the header; in terminal mode `cat` shows the same note without the header; the "In plain terms" box is verified end to end: the controller adds `blurb: "Every note I write on any machine lands on one home server, which checks it for private details and publishes the safe ones here."` to the frontmatter of the live Mac note `07 Tools and Workflow/Obsidian Vault Hub - Syncthing to Unraid Publishing.md`, waits for the next publish cycle, and confirms the box renders; the blurb stays (the owner may rewrite it).

- [ ] **Step 6: Commit**

```bash
git add garden-reader.js garden-reader.css garden-terminal.js
git commit -m "Add reader note header, wikilink resolution, and related notes"
```

---

### Task 7: Compose `blurb` curation key (public repo)

**Files (in a scratchpad clone of `https://github.com/AIMDaAlien/Obsidian-Vault.git`, branch `blurb-curation`):**
- Modify: `.github/scripts/composelib/notes.py` (`CURATION_KEYS`, `CurationEntry`, `load_curation`, `validate_curation`, `apply_curation`, new `BLURB_MAX = 400`, `QUOTED_KEYS` gains `blurb`)
- Modify: `.github/scripts/tests/test_compose_notes.py` (`CurationTests`)
- Modify: `.github/unraid/curation.yml` (no entries change; the file is where the owner adds blurbs later)
- Modify: `README.md` section "How this vault is published" (one sentence: `blurb` is an optional plain-language line up to 400 characters)

**Interfaces:**
- Produces: `CurationEntry(path, featured=None, summary=None, publish=None, blurb=None)`; `validate_curation` errors `"{path}: blurb must be a string"` and `"blurb too long ({n} > 400): {path}"`; `apply_curation` sets `blurb` quoted like `summary`.

- [ ] **Step 1: Write the failing tests** (in `CurationTests`, following `test_summary_must_be_string`)

```python
def test_blurb_must_be_string(self):
    root = self.root_with(**{"A.md": "# A\n"})
    self.assertEqual(validate_curation([self.entry("A.md", blurb=5)], root, {}),
                     ["A.md: blurb must be a string"])

def test_blurb_over_400_is_error(self):
    root = self.root_with(**{"A.md": "# A\n"})
    self.assertEqual(validate_curation([self.entry("A.md", blurb="x" * 401)], root, {}),
                     ["blurb too long (401 > 400): A.md"])

def test_apply_sets_blurb_quoted(self):
    out = apply_curation("---\ntitle: A\n---\nbody\n", self.entry("A.md", blurb='Plain "words" here'))
    self.assertIn('blurb: "Plain \\"words\\" here"', out)

def test_load_curation_accepts_blurb(self):
    p = self.write_yaml("- path: A.md\n  blurb: hello\n")
    self.assertEqual(load_curation(p)[0].blurb, "hello")
```

Adjust `self.entry` / `self.write_yaml` names to the helpers the class already has (read the class first; add a helper only if none exists).

- [ ] **Step 2: Run to verify they fail**

Run: `python3 -m unittest discover -s .github/scripts/tests -t .github/scripts -k blurb`
Expected: 4 failures (`unexpected keyword argument 'blurb'` or `unknown key blurb`)

- [ ] **Step 3: Implement**, mirroring the `summary` code paths exactly, with `BLURB_MAX = 400`.

- [ ] **Step 4: Run the whole suite**

Run: `python3 -m unittest discover -s .github/scripts/tests -t .github/scripts`
Expected: all pass (186 + 4)

- [ ] **Step 5: Commit on the branch, then stop and ask the owner before pushing**

```bash
git -c user.name=AIMDaAlien -c user.email=AIMDaAlien@users.noreply.github.com commit -am "Accept blurb as a curation key"
```

The push to `main` and the Unraid image rebuild are the controller's ops step (Task 8), gated on owner consent.

---

### Task 8: Ship: push the public repo change, rebuild the publisher, publish the portfolio

**Files:** none new. Ops only; run by the controller, not a subagent.

- [ ] **Step 1: With owner consent, fast-forward the public repo `main`** from the `blurb-curation` branch and confirm the `Generate Garden Manifest` workflow and the test workflow pass (`gh run list -R AIMDaAlien/Obsidian-Vault --limit 3`).

- [ ] **Step 2: Rebuild the publisher image on Unraid**

```bash
ssh unraid 'cd /mnt/cache/vault/published && git pull --ff-only && docker build -t vault-publisher:latest -f /mnt/cache/appdata/vault-publisher/bin/Dockerfile .github/scripts && /mnt/cache/appdata/vault-publisher/bin/publish.sh; head -3 /mnt/cache/vault/last-run.md'
```

Expected: build succeeds; `last-run.md` first line ends `— ok` or `— no-op`.

- [ ] **Step 3: Run the full manual checklist** from spec §10 at 1440 and 390 widths in the owner's browser against the local server, and `node --test tests/` one last time (expected 15 passing).

- [ ] **Step 4: Append an Outcome section to the spec** (what shipped, what was deferred) and commit; push the portfolio `main` with owner consent.

```bash
git add docs/superpowers/specs/2026-10-20-garden-reader-design.md
git commit -m "Record garden reader mode outcome"
```
