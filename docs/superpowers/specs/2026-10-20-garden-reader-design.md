# Knowledge Garden Reader Mode: Design

**Date:** 2026-10-20
**Status:** Approved 2026-10-20
**Builds on:** `2026-10-18-vault-hub-design.md` (the vault hub that produces `garden-manifest.json`)

## 1. Problem

The Knowledge Garden page (`garden-terminal.html`) is a file browser with a floating shell. A first-time visitor sees numbered folders, an `_attachments` directory, root housekeeping files, a Quick Start made of `cd`, `cat`, and `ls`, and a terminal window covering two featured cards. Cards show a title, a folder name, and a date. Notes open as raw rendered markdown with wikilinks printed as literal `[[brackets]]`. The 82 summaries written for ranked notes are never shown.

The content is strong and the design system is polished. The friction is presentation.

## 2. Goal and audience

One page serves two readers at once:

- **The skimmer** (recruiter, customer, friend) wants to know what was built and why in under two minutes, with no shell vocabulary.
- **The technical reader** wants the file tree, the terminal, and the commands exactly as they are today.

Success: a skimmer landing cold can name three projects and what each is for without opening the terminal or a folder. A technical visitor loses nothing.

## 3. Decisions made in conversation

| Question | Decision |
|---|---|
| Audience | Mixed; both served on one page |
| Terminal on first visit | Visible but minimised to a one-line hint bar |
| Left side in reader mode | Human topics with descriptions, not the folder tree; tree stays in terminal mode |
| Above a note | Header from existing data, plus a hand-written `blurb` for the ten strip notes only |
| Approach | Reader layer inside the existing page, not a separate page and not a patch of the current layout |

## 4. Modes

The page keeps one URL and one `KnowledgeGarden` instance. `html` carries `data-mode="reader"` or `data-mode="terminal"` (set by an inline head script before any stylesheet, so there is no flash) and `body` mirrors it once the reader initialises. The mode is stored in `localStorage` under `garden-mode` and defaults to `reader`.

**Reader mode**
- Sidebar shows the topic list (Section 5), not the file tree.
- Content pane shows the landing view, a topic page, or a note with its header (Section 6).
- The floating terminal is replaced by a hint bar pinned bottom-right: a prompt glyph and the text "press ` for the terminal". Clicking it or pressing backtick (outside an input) switches to terminal mode.
- The git-flavoured status bar is hidden.

**Terminal mode**
- The page exactly as today: file tree, floating terminal open, status bar, all commands.
- A `reader` button in the terminal title bar and a new `exit` command switch back.

**Shared behaviour**
- Opening a note in either mode calls the same note view. Switching modes keeps the open note.
- `?note=<path>` deep links open the note in whichever mode is stored.
- First render waits until the stored mode is read, so a reader-mode visitor never sees the terminal flash.
- At phone width (`max-width: 768px`) reader mode is the default and the terminal is reachable from the menu but never pinned.

## 5. Landing view and topics

**Landing view** (first visit, and the "home" breadcrumb):
1. One sentence in plain words stating what the garden is.
2. A search box filtering cards live by title, summary, and tags from the manifest. No full-text search.
3. **Featured**: the ten notes with `featured` rank 1 to 10, as cards showing title, topic label, summary, and updated date.
4. **Topics**: the list below, each with its description and note count.

**Topic map** (fixed in the reader script; keyed by top-level folder):

| Folder | Label | Description |
|---|---|---|
| `01 Projects` | Projects | Things I built end to end |
| `02 Homelab` | Homelab | The physical servers, network, and the builds and upgrades behind them |
| `03 AI and Local Models` | AI and benchmarks | Running models on my own hardware, with the numbers |
| `05 Linux and Systems` + `04 Programming` | Linux and systems | Notes from the command line and the code |
| `06 Learning Journals` | Learning journals | What I was figuring out, as I figured it out |
| `07 Tools and Workflow` | Tools and workflow | How the notes, the sync, and the publishing work |

`00 Index`, root-level files, `_attachments`, and anything matching the existing hidden-path rules never appear in reader mode. Only `publish: true` notes appear anywhere in reader mode.

**Topic page**: description, then the topic's ranked notes as cards ordered by `featured`, then a "More notes" divider, then unranked notes ordered by `updated` descending.

**Cards without a summary** show the first paragraph of body text, fetched lazily with an `IntersectionObserver` when the card scrolls into view, truncated to 160 characters. A fetch failure leaves the card with title and date only.

**Sidebar** in reader mode lists the topics with counts and collapses to the same drawer the tree uses on mobile.

## 6. Note view

In reader mode a header renders above the markdown body:

- Title, topic chip, origin ("written on BigRig" when `machine` is `bigrig`, "on the Mac" when `mac`, nothing otherwise), created and updated dates, reading time (`ceil(words / 200)` minutes).
- The `summary` as a lede paragraph when present.
- The `blurb` in a highlighted "In plain terms" box when present.
- Breadcrumb reads `Topic › Note`. Terminal mode keeps the folder path.

**`blurb`** is a new frontmatter field: a string of at most 400 characters. Mac notes carry it in frontmatter. BigRig notes carry it in `curation.yml`, which requires the compose code to accept `blurb` as a curation key and inject it like `summary`. The manifest generator already passes arbitrary frontmatter through. Only the ten strip notes are expected to have one; the UI treats it as optional everywhere.

**Links**. The reader builds a title index once per manifest load: every published note's filename stem and `title` field, lowercased, map to its path. When two notes share a key, the one with the lower `featured` rank wins, then the lexically smaller path. Then:
- `[[Name]]`, `[[Name|alias]]`, and `[[Name#heading]]` (heading ignored) in the rendered body become in-page links when the index resolves them, including links across the Mac and BigRig vaults. Unresolved links render as the alias or name in plain text. Terminal mode gets the same resolution, since both modes share the renderer.
- **Related notes** at the end of the note: up to five published notes this note links to (from the manifest `links` map, resolved through the index) and up to five published notes that link to it, as small cards with summaries. Either list is omitted when empty.

The body is unchanged: same `marked` configuration, same sanitiser, nothing collapsed. In reader mode the body's leading H1 is hidden by CSS under the header, since the manifest title is that same H1.

## 7. Code structure

No build step, no frameworks, existing tokens from `m3e-tokens.css`.

- **`garden-reader.js`** (new). Owns the mode switch, landing view, topic map and pages, search filter, note header, title index, wikilink and related-note resolution, lazy snippet loading, and the hint bar. It holds the `KnowledgeGarden` instance and calls `fetchManifest()`, `fetchNote(path)`, `renderMarkdown(content)`, and `sanitizeRenderedHtml(html)`. Pure logic (topic mapping, index building, link resolution, related selection, search filter, reading time, snippet truncation) lives in exported functions with no DOM access.
- **`garden-reader.css`** (new). Loaded after `garden-terminal.css`. Styles only elements under `body[data-mode="reader"]` plus the hint bar, so terminal mode is untouched.
- **`garden-terminal.js`** (modified). Adds the `exit` command and the `reader` title-bar button; lets `viewFileByPath` accept an optional header fragment inserted above the body; applies wikilink resolution through a hook the reader registers; filters `publish: false` and hidden paths out of the tree so both modes show the same set; defers first render until the mode is known; removes the dead hard-coded fallback card from `showWelcome`.
- **`garden-terminal.html`** (modified). Adds the hint bar, the reader sidebar container, `data-mode` on `body`, the two new files, and removes the hard-coded fallback card.
- **`script.js`** (modified). The main page's featured-project count reads the manifest's `featured` entries capped at ten instead of the constant 6.
- **Public repo `composelib`** (modified, separate commit). `blurb` accepted in `curation.yml` with the same type check as `summary` (string, max 400 characters) and injected into frontmatter. Tests in the existing suite. Publisher image rebuilt on Unraid.
- **`AGENTS.md`** section 7 gains `exit` and a short note on the two modes.

If `garden-reader.js` fails to load, the page falls back to terminal mode as it is today.

## 8. Errors

- Manifest fails to load: reader mode shows the existing friendly error with a retry button.
- Note fails to fetch: the header still renders from manifest metadata; the body shows the existing error.
- Missing `summary`, `blurb`, `tags`, `machine`, or dates never break a card or header; each is simply omitted.
- Unresolved wikilinks render as text, never as dead anchors.

## 9. Cleanup folded in

- Dead fallback card in the HTML removed.
- `_attachments`, root housekeeping files (`Index.md`, `README.md`, `Redaction Conventions.md`, `markdown practice.md`), and `publish: false` notes hidden in both modes.
- Main-page "6 featured projects" constant replaced by a manifest-derived count.

## 10. Testing

- **Unit**: the pure functions in `garden-reader.js` get a `node --test` file under `tests/garden-reader.test.js`, run with `node --test tests/`. Cases: topic mapping including the `04 Programming` fold and unknown folders; title index with duplicate titles (first by rank wins, then by path); wikilink resolution for `[[Name]]`, `[[Name|alias]]`, `[[Name#heading]]`, unresolved, and cross-vault; related-note selection caps and ordering; search filter on title, summary, and tags; reading time; snippet truncation at a word boundary.
- **Compose**: tests for `blurb` accepted, rejected when not a string or over 400 characters, and injected into output frontmatter.
- **Manual checklist** at 1440 and 390 widths: first visit lands in reader mode with no terminal flash; hint bar switches modes by click and backtick; `exit` returns; mode persists across reload; `?note=` opens in both modes; topic pages, search, featured strip, note header, blurb box, related notes, resolved wikilinks; terminal mode identical to today.

## 11. Rollout

Reader mode is the default from the first deploy; no flag. The ten blurbs can be written any time and appear as they publish. The vault, Syncthing, and Unraid change only by the compose `blurb` passthrough and image rebuild.

## 12. Out of scope

Full-text search, tag cleanup and tag navigation, the graph view, summaries for unranked notes, DOMPurify or SRI, lazy manifest loading.

## 13. Follow-up phases (not this plan)

- **Note consolidation pass.** Some notes would read better merged (overlapping session notes, duplicate guides across the Mac and BigRig vaults). Owner rule from 2026-10-20: notes for active projects are not consolidated; only finished or reference material is a candidate. Done as a content pass in the vault with dated merge notes, after reader mode ships, starting from a candidate list produced by scanning titles, tags, and the links map.
- **Garden code, later:** full-text search, tag cleanup and navigation, the graph view.

## 14. Outcome (2026-10-21)

**Shipped on branch `garden-reader`** (portfolio) and `blurb-curation` (public vault repo), implemented natively from the plan with a fresh whole-branch review at the end.

- `garden-reader-logic.js` with 18 `node --test` cases; `garden-reader.js` and `garden-reader.css`; hooks in `garden-terminal.js`; `garden-terminal.html` markup; `script.js` count clipped at ten.
- Reader mode is the default, the hint bar and backtick toggle terminal mode, `exit` and the ⇤ button return, the mode persists in `localStorage`.
- Landing view, six topics with counts, featured strip with summaries, search over title/summary/tags, lazy snippets for cards without a summary.
- Note header with topic chip, origin, dates, reading time, lede, and the "In plain terms" blurb box, verified end to end with a blurb on the vault hub note.
- Wikilinks resolve through a title index in both modes; unresolved links render as text; unresolved embeds are dropped. Related notes list up to five each way.
- Housekeeping paths and `publish: false` notes are hidden in both modes; the dead fallback card is gone.
- Compose accepts `blurb` (string, ≤ 400) with four tests; publisher image rebuild is part of the ship step.
- Bug fixed on the way: the shared in-flight fetch in `net-utils.js` handed one Response to concurrent callers.
- Review fixes: refresh keeps the reader header and scroll position, missing reader script falls back to terminal mode, cold load shows the intro instead of the terminal welcome, in-app navigation resets the content scroller, attribute values escape quotes.

**Deferred** (reviewer minors, recorded in the plan ledger): double-backtick and indented code spans still get wikilinks rewritten; snippets can start with a table row or callout marker; no concurrency cap on lazy snippet fetches; the body H1 is hidden unconditionally; `machine: unraid` has no origin label; topic pages have no URL state; a refresh while searching clears the query; the manifest is parsed twice at startup; folders-only tree when the manifest is down but the API is up; the main-page featured count counts all ranks; sidebar labels still say "file navigation" in reader mode.

**Not consolidated in this phase:** notes. The consolidation pass in §13 is still next.

### Personality pass (2026-10-21, after the owner's review)

The owner's feedback on the first build: per-sub-project card colours made no sense ("three different colours for projects"), and the reader looked less like them. Agreed in chat and shipped on the same branch (commits e1c5344, e5904ec, 584e2de):

- **One colour per topic**: projects blue, homelab cyan, ai green, linux magenta, journals yellow, tools periwinkle (`topicColor`). The old `getProjectColor` map survives only in terminal mode.
- **Proportional mixing**: a card's accent bar is a hard-stop vertical gradient of its own topic (at least half) plus up to two linked topics, weighted by links in both directions (`accentStops`, `accentCss`). 67 of 391 live notes mix.
- **Folder groups**: topic pages group by sub-folder under `aim@garden:~/projects$ ls penthouse/` headings; groups with a strip note come first, then by size. Inside a group ranked notes lead, then linked notes chain next to each other, then newest (`groupByFolder`).
- **Voice**: all reader copy lowercase in the owner's words; section headings are shell prompts in JetBrains Mono; the status bar stays visible with a shell-style path (`readerPath`); blobs tint toward the active topic; cards carry a faint accent wash and a hover glow.
- **Playful bits**: a neofetch-style about card with live manifest numbers (`gardenFacts`), one-click easter eggs (`neofetch`, `cowsay sup`, `matrix`, `whoami`, `help`) that switch to the terminal and run, and a once-per-session boot line plus typed intro (`shouldBoot`; skipped under reduced motion).
- **Found on the way**: eight composed notes stack a stale second frontmatter block under the first (four in Homelab/Session Notes, two in Linux/Fundamentals, one in Homelab/Guides, plus the hidden `markdown practice.md`). The reader now strips every leading block; the vault content should still be cleaned at the source.
