# Vault restructure, fresh public repo, and garden rerank

**Date:** 2026-10-16
**Status:** Design, awaiting owner review
**Scope:** The Obsidian vault that feeds the Knowledge Garden. Portfolio site code is out of scope (see "Deferred work").

## 1. Context and goals

The live vault at `~/Documents/Notes/Obsidian Notes Vault` is a git clone of the public repo `AIMDaAlien/Obsidian-Vault`. The portfolio's Knowledge Garden reads `garden-manifest.json` from that repo. A privacy audit on 2026-10-15 (`~/Documents/Projects/Portfolio Audit 2026-10-15/`) found a tracked Local REST API key and private key, home WAN IPs, a full LAN map, customer names, a business phone, a MAC address, and a device serial in a screenshot, all in a public history of 346 commits. The vault structure also drifted: 209 of 842 wikilinks are broken, 131 freeCodeCamp step notes carry one snippet each, and nine overlapping frontmatter keys gate publishing.

Goals, in priority order:

1. No secret or personal identifier in the public repo or its history.
2. The vault stays public as documentation for others. Technical and business notes publish with identifiers redacted in place.
3. A folder structure and frontmatter schema the garden can rely on, with `publish` as the single gate and `featured` as a rank.
4. A permanent automated privacy gate so this does not recur.

Success means: a fresh public repo whose only commit passes the privacy gate with zero hits, the garden still loads from the same URL, Obsidian and obsidian-git push cleanly afterwards, and the owner can rerank featured notes by editing frontmatter.

## 2. Decisions already made by the owner

These are settled and are not revisited in the plan.

1. Vault stays public by design.
2. Everything technical or business publishes with PII redacted in place. Personal notes are excluded via one gitignored `_private/` folder. Today that is one note: `01 Projects/Life/00 - Life Idea.md`.
3. Delete the CS50 note and all 38 non-freeCodeCamp notes in `04 Programming` (Python, C, General Programming, Computer Science Concepts, Web Development, Programming Concepts Index). `05 Linux and Systems` stays.
4. freeCodeCamp step notes are compressed into a few real notes. The consolidation code is one-shot, lives in the scratchpad, and never enters the repo.
5. Network Map, Services Dashboard, and Server Inventory are redacted in place with structure kept. The owner accepts that the port table, Unraid mount paths, hardware models, and backup schedule remain visible.
6. Git history: start a fresh repo. The old repo becomes a private archive.
7. Approach: scripted migration against a staging copy in the scratchpad, reviewed, then one swap into the live vault with Obsidian closed, one push.
8. Permanent artifacts in the new repo are the privacy gate and the updated manifest generator only. The migrator and the redaction table are throwaway inputs.
9. The Unraid LLM Serving Throughput note is publishable.
10. Archive notes are eligible for featuring. `featured` is a frontmatter rank independent of folder.
11. AI notes are organized by machine and engine, with `machine:` and `engine:` frontmatter keys.

## 3. Folder structure (approved Section 1)

Rules: keep the seven numbered top-level folders; no folder contains a single same-named subfolder; no loose notes at a numbered root except its index; one project, one folder; `_private/` is the only gitignored content folder.

Counts are note counts after migration.

```
Index.md
Redaction Conventions.md
01 Projects/
  Penthouse/               30  (+ Self-Hosting/ 14; + Repo Archive/ 22 and
                                Rebuild Archive/ 7, both now public)
  Teardown Cafe/           27  (Documentation/ kept, Sessions/ -> Session Notes/,
                                + Teardown Documentation Lessons from Archive)
  Portfolio Website/       12  (absorbs Portfolio Website Development, + Knowledge
                                Garden Sidebar Session and Tag System from Archive)
  3D Print Shoppe/         23
  Tech Consulting/         16
  TypingLab/               10
  Veyra Companion/         10
  Local Language Engine/    6  (machine: mac, engine: mlx)
  Corne Accuracy Trainer/   5
  Ironmind/                 2
  MetalBench/               1
  Wear Browser/             1
  (Archive/ dissolved; Homelab NOC Skills/ moved to 02; Sovereign AI Stack/ to 03;
   Life/ to _private/)
02 Homelab/
  Overview/                 3  (Server Inventory, Services Dashboard, Network Map)
  Guides/                   6  (TrueNAS Build Guide, Budget SAS NAS Build, Pi-hole
                                Setup Guide, Pi-hole Migration RPi B+ to RPi 5,
                                Pi-hole TrueNAS Network Conflict, WireGuard VPN Setup)
  Router Configuration/     8
  Reference/               11  (+ BigRig TUF X670E BIOS Configuration,
                                + Storage Cleanup and TM Backup Decisions)
  Session Notes/           13  (+ the 4 Homelab NOC Skills notes)
03 AI and Local Models/
  Mac - MLX/                8  Gemma 4 on M5 Pro, Gemma 4 QAT Q4, Q8, LFM2.5-2.6B,
                               LFM2.5-8B-A1B, Maple-Preview 20B, Ternary Bonsai 27B,
                               Qwen3.8-27B
  Unraid - llama.cpp/       8  Unraid LLM Serving Throughput, Qwen3.8-Flash-Next 262K,
                               K2-Horizon MoVA, Deepwen-3.6, GLM-5.3-Flash,
                               Qwen3.8-Flash-Next, Unraid Qwen3.6 Terminal Agent
                               (SGLang), Frontier Landscape 128GB
  Unraid - Ollama/          5  Architecture Guide, Project Overview, Project Status,
                               Setup Tutorial, Speed Myth (the old Sovereign AI Stack)
  Benchmarks/               3  LLM Benchmark Registry Mac vs Unraid, Nemotron vs
                               Qwen Fingerprint, Local AI Benchmark Content Site
  (no BigRig folder until a BigRig note exists)
04 Programming/
  Web Fundamentals/         3  HTML Fundamentals - CatPhotoApp, CSS Fundamentals -
                               Cafe Menu, CSS Colors and Box Model - Colored Markers
05 Linux and Systems/      94  the 13 topic folders flattened up one level
                               (Command HIstory steps folded into History.md,
                               Command Types steps folded into Command Types.md,
                               fix the "HIstory" and "Globiing" typos)
06 Learning Journals/       6  flattened
07 Tools and Workflow/     ~11 (+ GrapheneOS Migration Guide, Claude-Cursor Workflow
                               from Archive; Personal Setup.md deleted as empty
                               placeholder; the 5 Bridges notes become the index
                               notes of the folders they describe)
_private/                      gitignored: Life Idea
images/                        LG G8 screenshots that survive Section 5.4 (8 exist locally today)
```

The migrator carries a rename map (old path to new path) covering every moved note. The plan derives the map from the audit reports' per-folder listings.

## 4. Frontmatter schema (approved Section 2)

### 4.1 Keys

Replace `published`, `published_to_garden`, `visibility`, `garden_path`, `last_published`, `privacy_scan`, `archived_from`, and `modified` with:

```yaml
title:      # optional; generator falls back to H1, then filename
summary:    # one line for cards; migrator leaves blank, owner fills over time
tags: []    # trailing inline #hashtag lines folded in, then removed from body
created: YYYY-MM-DD
updated: YYYY-MM-DD   # optional override only; see 4.3
publish: true         # single gate; false = in repo, hidden from garden
featured:             # optional int rank; absent = not featured
machine:              # mac | unraid | bigrig | pi
engine:               # mlx | llama.cpp | ollama | sglang | lm-studio
project:              # optional, folder name
status:               # optional: active | done | archived
```

`repository` is kept on the 8 notes that have it. Any other key not listed here is kept untouched; the migrator only removes the eight named keys.

### 4.2 Migration mapping

- `publish`: old `published_to_garden` if present, else `published`, else `visibility == public`, else `true`. Notes with `visibility: private` or `visibility: review` get `publish: false`.
- `created`: kept if present, else the file's first-commit date from the old clone's git log, read once during staging.
- `updated`: not written by the migrator.
- `tags`: existing tags, plus any trailing `#hashtag` lines in the body (for example the `#Web` line on step notes), lowercased, deduplicated. The hashtag lines are removed from the body.
- `machine` and `engine`: set on every note under `03 AI and Local Models/` from its folder, and on `Local Language Engine/` (`mac`, `mlx`).
- `project`: set on every note under `01 Projects/<folder>/` to `<folder>`.
- The one note with invalid YAML (`tags: []` followed by list items, in Privacy-First Obsidian Publishing System) gets its frontmatter rewritten. The 2 notes with no frontmatter get the minimum block (`tags: []`, `created`, `publish: true`).

### 4.3 The `updated` decision

No installed plugin maintains an `updated` key and obsidian-git never touches frontmatter. So the manifest generator computes `updated` from the last commit touching each file and emits it into the manifest. A frontmatter `updated` wins when present. On day one every note shows the cutover date because the fresh repo has one commit. The old history is not carried over; this is the accepted cost of a fresh history and self-corrects as notes are edited.

### 4.4 Initial featured ranks

Assigned by the migrator, rank 1 to 15 in this order. The owner reranks later in Obsidian.

1. Backend Hardening Checklist
2. Reliability Fix Log
3. 2026-01-20 WAN Instability log
4. Self-Hosting series index
5. Unraid Pool Recovery
6. Pi-hole Migration
7. DNS Loop
8. Privacy-First Obsidian Publishing System
9. Obsidian Vault Git Sync
10. Portfolio Website Current State
11. Penthouse Architecture in Plain English
12. Prometheus Grafana Lessons Learned
13. LLM Benchmark Registry
14. TrueNAS Build Guide
15. Unraid LLM Serving Throughput

## 5. Redaction rules (approved Section 3)

### 5.1 Placeholders

Numbering is stable per distinct value across the whole vault, so the Unraid box is `<lan-ip-1>` in every note.

| Pattern | Placeholder |
|---|---|
| RFC1918 IPv4 (minus allowlist) | `<lan-ip-N>` |
| Public IPv4 (the 3 WAN values) | `<wan-ip>` |
| MAC address | `<mac>` |
| `*.duckdns.org` | `<ddns-host>` |
| `*.ts.net` hostname | `<tailnet-host>` |
| Business phone | `<phone>` |
| The two customer names (5 files: Customer Inquiries & Responses, README - Main Index, Business Plan Overview, Market Research Findings, and the inquiries note's second name) | `<customer-A>`, `<customer-B>` |
| `/Users/aim`, `C:\Users\Aim` | `~` |
| `root@<ip>` | `<user>@<host>` |
| `.env.unraid*` paths | `<env-path>` |
| Penthouse admin username (`13 - Unraid Production Operations.md:207,251`) | `<admin-user>` |
| `*.<owner-handle>.chatgpt.site` URL | `<private-deployment>` |

The exact values for phone, customer names, admin username, and WAN IPs live in the throwaway redaction table in the scratchpad, never in the repo.

### 5.2 Lines removed outright

- Any line containing `login.tailscale.com/a/` (3 notes).
- The `sshpass` line in `The Penthouse/2025-02-13 Session Notes.md`.
- The salary-range and career-path-scoring sections of `02 Homelab/Session Notes/2025-10-01 Uptime Kuma Attempt & Career Path Analysis.md` (audit lines 46-60, 200, 281). The Uptime Kuma half stays.

### 5.3 Allowlist

Loopback (`127.0.0.1`), `0.0.0.0`, public resolvers (`1.1.1.1`, `8.8.8.8`, `9.9.9.9`, `208.67.x.x`), Cloudflare proxy IPs (`104.21.9.162`, `172.67.160.73`), Vercel `216.198.79.1`, tutorial addresses (`192.168.1.1`, `10.6.0.1`, `172.17.0.1`, `192.168.0.0/16` as a CIDR literal), version strings shaped like IPs (four dotted groups where any group has a leading zero or exceeds 255, or the string is immediately preceded by a word like "firmware" or "version"), `example.com` addresses, `/home/sysadmin`, `cdn.freecodecamp.org`, placeholder phones `555-...`, example DDNS hosts in Router Configuration.

### 5.4 Files deleted

`images/LG-G8-fastboot-wrong-identity.png` (device serial), `images/LG-G8-qfil-sahara-failure.png`, `images/LG-G8-kdztools-extraction.png`, and whichever of the two `LG-G8-edl-*.png` files show the Windows hostname or username. The live vault holds 8 images today; the plan views each one before finalizing the delete list, since the audit's wording on the edl pair is ambiguous. Embeds pointing at deleted images are replaced with an italic line "screenshot removed: showed workstation identifiers". Every other image stays.

### 5.5 Kept as-is

Port table, Unraid mount paths, hardware models, backup schedule, Cloudflare-proxied public domains, git SHAs and release names. Owner decision 5.

### 5.6 Supporting rules

- `.obsidian/` is fully gitignored in the new repo.
- Owner rotates the Local REST API key and certificate in Obsidian before the cutover.
- Commits in the new repo use the GitHub noreply author email.
- `Redaction Conventions.md` at the vault root explains every placeholder so the documentation stays readable.
- The `.github/scripts/vault-auto-sync.sh` hardcoded path is replaced with the correct vault path expressed as `$HOME/...`.

## 6. freeCodeCamp consolidation, one-shot (approved Section 4)

### 6.1 Inputs to outputs

| Source folder | Files | Output note |
|---|---|---|
| `04 Programming/Programming Concepts/HTML/Build CatPhotoApp` | 69 steps | `04 Programming/Web Fundamentals/HTML Fundamentals - CatPhotoApp.md` |
| `04 Programming/Programming Concepts/CSS/Build a Cafe Menu` | 42 steps | `04 Programming/Web Fundamentals/CSS Fundamentals - Cafe Menu.md` |
| `04 Programming/Programming Concepts/CSS/CSS Colored Markers` | 6 named notes | `04 Programming/Web Fundamentals/CSS Colors and Box Model - Colored Markers.md` |
| `05 Linux and Systems/Linux/Linux/Command HIstory` | 3 steps + History.md | `05 Linux and Systems/History.md` |
| `05 Linux and Systems/Linux/Linux/Command Types` | 4 steps + 6 named | `05 Linux and Systems/Command Types.md` |

129 input files become 5 notes.

### 6.2 Process

1. A scratchpad script orders each folder's files (by step number, then by the order the named notes link to each other, then alphabetical) and writes one bundle file per tutorial.
2. Five sonnet subagents run in parallel, one per tutorial. Each is read-only on the vault and writes its draft only to the scratchpad.
3. The main model reviews each draft against its bundle before accepting it.

### 6.3 Draft contract

Each output note has:

- A credit line at the top linking the freeCodeCamp course it came from.
- Sections grouped by theme, not by step. No step numbers survive.
- Every step's explanation preserved in prose.
- Code shown only where a new element, property, or command first appears.
- A final complete-result block (the last step's full code, or for the Linux notes a command reference table).
- Section 4 frontmatter, with `tags` from the folded hashtags plus `html`, `css`, or `linux`.

### 6.4 Acceptance checks

Before the source files go on the delete list:

- Main model walks each source step and confirms its key concept appears in the draft (a checklist pass, not a diff).
- The final code block equals the last step's complete result.
- No wikilink anywhere in the staging copy points at a deleted step file; the link rewriter maps step-file targets to the consolidated note.

### 6.5 Cleanup

The 129 source files are added to the migrator's delete list. Bundles, drafts, and the ordering script are deleted from the scratchpad after the cutover commit.

## 7. Fresh-repo cutover (approved Section 5)

### 7.1 Pre-flight (owner)

1. Rotate the Local REST API key and certificate in Obsidian.
2. Confirm the 4 dirty files in the live vault are pushed, or accept that they ride along in the staging snapshot.

### 7.2 Staging, vault untouched

3. Copy the live vault to the scratchpad. Read each file's first-commit date from the old clone's `.git` once, into a sidecar JSON.
4. Run the migrator in this order: delete list, rename map, Section 6 consolidated notes, link rewrite (rename map, then basename, then title match), frontmatter normalization, redaction table, career-section strip.
5. Rerun the three audit censuses (structure, frontmatter, privacy) on the staging copy. Gates: zero privacy hits; broken-link count reported and lower than 209; `publish: true` count printed.
6. Owner spot-checks a diff summary and a handful of named notes (Network Map, Customer Inquiries, one consolidated freeCodeCamp note, one AI note).

### 7.3 Swap, one sitting

7. Close Obsidian and verify `pgrep -x Obsidian` prints nothing. Pause the Syncthing folder so `.git/` churn does not mirror to Unraid mid-swap.
8. `gh repo rename Obsidian-Vault Obsidian-Vault-archive`, then `gh repo edit AIMDaAlien/Obsidian-Vault-archive --visibility private`.
9. `gh repo create AIMDaAlien/Obsidian-Vault --public`. The same name keeps the garden fetch URLs working; GitHub drops the old redirect when the name is reused.
10. In the live vault: delete `.git`, then rsync the staging copy over it with `--delete`, excluding `.obsidian/` and `_private/`.
11. `git init`, write the new `.gitignore` (`_private/`, `.obsidian/`, `.DS_Store`, `*.tmp`), set the noreply author email for this repo, run the privacy gate, make one commit "Initial sanitized vault", push to `main`.
12. Fix the launchd plist path and add the gate call to the sync script before `git add`. Resume Syncthing. Reopen Obsidian and confirm obsidian-git pushes cleanly and the manifest workflow goes green.

### 7.4 Rollback

Until step 10 the live vault is untouched and nothing is lost. After step 10, the private archive repo plus the pre-swap staging copy restore everything. If step 9 fails after step 8, rename the archive back.

## 8. Privacy gate and generator update (approved Section 6)

### 8.1 `.github/scripts/privacy-gate.py` (new, permanent)

- Scans every git-tracked text file (`git ls-files`), not the working tree, so gitignored `_private/` and `.obsidian/` never trip it.
- Patterns: the Section 5.1 table plus `BEGIN .* PRIVATE KEY`, `tskey-`, `ghp_`, `github_pat_`, `AKIA`, Discord webhook URLs. The Section 5.3 allowlist is a list at the top of the file.
- Lists image files new since the previous commit as a warning for manual review, not a failure.
- Exit 1 with one `path:line: pattern-name` line per hit. Exit 0 prints `privacy gate: clean, N files`.
- Runs in three places:
  - the manifest workflow, as a step before generation, so a leak turns the run red and no manifest commit happens;
  - `vault-auto-sync.sh`, before `git add`;
  - a `pre-commit` hook. obsidian-git uses isomorphic-git and skips hooks, so the workflow step is the real backstop. A leaked push still lands in history; the gate limits blast radius, it does not replace care.

### 8.2 `.github/scripts/generate-manifest.py` (updated)

- Parse YAML lists for `tags`, both inline `[a, b]` and block form.
- Title precedence: frontmatter `title`, then first H1, then filename without extension.
- Emit `summary`, `publish`, `featured` (int), `machine`, `engine`, `project`, `status`, `repository`, `created`, `updated`.
- `updated`: frontmatter value if present, else the last commit date for the path from `git log -1 --format=%cs -- <path>`. The workflow checkout gets `fetch-depth: 0`.
- Summary line reports the `publish: true` count.
- `.base` files are dropped from the tree.
- Manifest keys `generated_at`, `tree`, `metadata`, `links` are unchanged, so the current garden keeps loading until the garden spec lands.

### 8.3 Testing

`.github/scripts/tests/` gets a pytest file per script with fixture notes: one clean note, one note per pattern class, one note per frontmatter form (inline list, block list, no frontmatter, invalid YAML). The workflow runs pytest before the gate. Tests ship in the new repo.

## 9. Deferred work, not in this spec

- **Garden code spec** (next brainstorm): featured strip reads `featured` and `publish`; homepage ticker gates on `publish`; graph link resolution by title and path; render callouts, embeds, mermaid; DOMPurify and SRI; lazy manifest with ETag; AGENTS.md section 7 refresh.
- **Portfolio site fixes:** see `CONTINUATION-PROMPT.md`.
- **Cloudflare DNS for teardown.cafe:** owner, in the dashboard.

## 10. Open items for the owner before implementation

None. Everything in this spec was approved in chat on 2026-10-16.

## 11. Outcome (2026-10-17)

Cutover completed. The old repository is `AIMDaAlien/Obsidian-Vault-archive` (private). The new public `AIMDaAlien/Obsidian-Vault` starts from one sanitized commit plus a manifest commit; the generate-manifest workflow ran green on the first push.

| Measure | Before | After |
|---|---|---|
| Notes | 531 | 370 |
| Publishable (`publish: true`) | 82 flagged for garden | 331 |
| Featured | 0 | 15 |
| Broken wikilinks | 209 | 41 (all point at planned, unwritten notes) |
| Privacy gate hits | n/a | 0 across 377 tracked text files |
| Images | 8 | 3 (five showed workstation identifiers) |

Deviations from this spec, decided during execution: the admin username is also the owner's public GitHub handle and stays in repository URLs (the admin-account mentions in the ops note are redacted); the Local REST API key rotation was waived by the owner (the API binds to loopback only); the sync script runs the privacy gate after `git add -A` and unstages on failure; the version-string exemption for dotted quads never applies to private addresses; `.stfolder/` is gitignored alongside the four planned entries.
