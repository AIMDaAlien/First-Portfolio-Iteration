# Vault Hub Design: Unraid centralizes per-device Obsidian vaults and publishes the Knowledge Garden

Date: 2026-10-18
Status: approved in conversation, section by section (Sections 1 to 5 on 2026-10-18)
Predecessor: `2026-10-16-vault-restructure-design.md` (fresh sanitized public repo, `publish` gate, `featured` rank, privacy gate)
Successor, not this spec: the garden code spec (link resolution across vaults, tag cleanup, bare-filename embeds, the graph)

## 1. Goal

One published vault, composed on Unraid from per-device Obsidian vaults, so the Knowledge Garden reflects every machine the owner writes on. Each device keeps only its own notes. Unraid is the only publisher. The Mac stops pushing to GitHub.

Success means: a Mac note edited in Obsidian reaches the public repo within 15 minutes with the Mac doing nothing but Syncthing; BigRig notes and charts appear in the same repo and the same featured list; the privacy gate still runs before every push; the compose job never writes to a source vault; and the garden strip shows ten ranked notes from both machines.

## 2. Decisions already made by the owner

1. Per-device vaults. No device holds another device's notes. Syncing between devices "is an upkeep hassle".
2. Unraid centralizes and publishes (Approach 1 of three considered; Approaches 2 "Mac stays publisher" and 3 "GitHub Actions composes" rejected).
3. The existing Mac Documents and Downloads Syncthing shares stay as the general Mac backup, separate from the vault.
4. One featured list across both machines. The strip grows from 7 to 10 cards.
5. Physical hardware projects (Pi 5, mini PC, TrueNAS, Unraid builds and upgrades) must be visible; they are "the crux of what I really do".
6. Three tiers, one number: featured (ranks 1 to 10), useful (11 and up), archive (unranked, published, searchable, not promoted).
7. Corrections to BigRig notes are appended with dates, never overwrite old findings. The owner's agent on the BigRig ("omarchy") applies them from the brief given in conversation on 2026-10-18.
8. Curation for BigRig notes lives in a file on Unraid (owner did not object to the recommendation). Mac notes keep frontmatter as truth.
9. Link and tag reorganization across the two vaults, and the graph, are the next phase.
10. "Purge stale copies and anything redundant" (2026-10-18): the stale Unraid mirror of the Mac was purged and build output is ignored in the backup.

## 3. State as found on 2026-10-18 (settled facts)

- Unraid 7.2.4, SSH alias `unraid`, git 2.51 and rsync on the host, no Python on the host, image `ghcr.io/astral-sh/uv:python3.12-bookworm` present. Syncthing runs in the linuxserver container with `/mnt/user/syncthing` at `/sync`.
- BigRig vault already flows in: Syncthing folder `omarchy-vault`, receive-only, at `syncthing/BigRig/Obsidian`. 79 notes, 23 PNG and 14 SVG charts, about 170 attachment files (JSON, logs, CSV, Python, patches) under `_attachments/`. 69 of 79 notes carry frontmatter with `publish: true`; 5 carry `featured_candidate`; LAN addresses are already masked as `<lan-ip>`; no literal secrets, MACs, emails, or home paths. The folders already use the numbered scheme (`00 Index`, `01 Projects`, `02 Homelab`, `03 AI and Local Models`, `05 Linux and Systems`, `07 Tools and Workflow`) plus `_attachments`, `_inbox`, `assets`.
- The `vault` share exists on Unraid (datasets on cache and disk4) with `_backups/` (a pre-migration tarball of the omarchy vault from 2026-10-12) and an empty `omarchy/` folder.
- Mac: Syncthing.app 2.1.6, starts at login, same device identity as before, paired with Unraid. Its Documents and Downloads folders are now **send-only** on the Mac and **receive-only** on Unraid. The Documents folder ignores `/Notes/Obsidian Notes Vault` and build output (`node_modules`, `.venv`, `venv`, `.build`, `__pycache__`, `.gradle`, `DerivedData`, `.cache`, `.DS_Store`) on both sides. After ignores the Mac Documents share is about 54,000 files.
- Incident: the Unraid share filesystem (shfs, FUSE) segfaulted under Syncthing's bulk writes through `/mnt/user`, taking down penthouse.blog for about an hour. Recovered by stopping Docker, unmounting the docker image, lazy-unmounting `/mnt/user`, and cycling the array twice. Lesson carried into Section 4: no bulk pipeline traffic crosses FUSE.
- Stray copies on the Mac under `Documents/Notes/`: `knowledge-garden-vault` (2025 clone of the old garden vault, 342 notes, 10 dirty files) and `Obsidian/Projects/The Penthouse` (11 notes). Not touched. Out of scope; listed in Section 11.

## 4. Syncthing layout (approved Section 1, amended after the incident)

### 4.1 Shares and paths

The `vault` share becomes the hub. It is made a cache-only exclusive share: its disk4 part (the small `_backups/` and `omarchy/` folders) is moved to the cache dataset `cache/vault`, secondary storage is set to none, and exclusive access is enabled so `/mnt/user/vault` is a bind mount to `/mnt/cache/vault` with no FUSE. Layout:

```
/mnt/cache/vault/
  sources/
    m5pro/        Mac vault, Syncthing receive-only (new folder m5pro-vault)
    bigrig/       BigRig vault, Syncthing receive-only (existing folder omarchy-vault, path moved)
  published/      git clone of AIMDaAlien/Obsidian-Vault, written only by the compose job
  curation.yml    featured, summary, publish overrides (Section 6)
  compose.yml     job configuration (Section 5.5)
  last-run.md     report of the last compose run
  _backups/       existing; plus documents-stale-20261018/ from the purge
  logs/           compose job logs, 30 days
```

The Syncthing container gets a second bind mount, `/mnt/user/vault` at `/vault`. The existing `omarchy-vault` folder keeps its folder ID so the BigRig does not resync; its data is moved from `syncthing/BigRig/Obsidian` to `vault/sources/bigrig` with the Syncthing folder paused during the move, then its path is edited to `/vault/sources/bigrig`.

The Mac gets one new Syncthing folder, label `m5pro-vault`, path `/Users/aim/Documents/Notes/Obsidian Notes Vault`, type send-only, shared only with Unraid. Unraid accepts it receive-only at `/vault/sources/m5pro`.

### 4.2 Ignore rules

Both vault folders carry this `.stignore` on both ends:

```
.obsidian
.git
.github
.trash
.DS_Store
_private
```

`_private/` never leaves the Mac. Git metadata never travels. The `.github/` entry matters only until the Mac cutover removes that folder from the Mac vault (Section 7 step 6).

### 4.3 What stays as it is

`m5Pro-Documents` and `m5Pro-Downloads` remain the general Mac backup on the `syncthing` share, send-only from the Mac, receive-only on Unraid, with the ignores listed in Section 3. The `syncthing` share spans disk1 and disk4 and still goes through FUSE; the ignore rules reduced it from 380,000 to 54,000 files, which is the accepted mitigation. Consolidating it onto one pool is recommended, out of scope.

## 5. The compose job (approved Section 2)

### 5.1 Runtime

`compose.py` lives in the public repo at `.github/scripts/compose.py` with its tests at `.github/scripts/tests/test_compose.py`, next to the privacy gate. It runs on Unraid every 15 minutes from a cron entry persisted in `/boot/config/plugins/dynamix/vault-publish.cron`, which runs `/mnt/cache/vault/bin/publish.sh`. That wrapper takes a lock (`flock`, skip if held) and runs the job under a hard 45-minute timeout inside a container built once on Unraid from the uv image plus git (`vault-publisher:latest`, Dockerfile kept at `/mnt/cache/vault/bin/Dockerfile`, fixed container name so a second concurrent run is refused). Mounts: `/mnt/cache/vault/sources` read-only at `/sources`, `/mnt/cache/vault` read-write at `/vault` with `/vault/sources` re-bound read-only, the deploy key and `known_hosts` from `/root/.ssh` read-only, and the owner's privacy terms list from `/mnt/cache/appdata/vault-publisher/vault-privacy-terms` read-only at `/root/.vault-privacy-terms`; `--network host` so the Syncthing API on the host is reachable. The wrapper refuses to start when any of those host files is missing. No path under `/mnt/user` is ever used by the job. (Amended 2026-10-18 after the final review: the stale-lock breaking first described here was dropped in favour of the timeout.)

### 5.2 Steps per run

1. **Wait for quiet.** Query the Unraid Syncthing API (`/rest/db/status` for both vault folders, API key passed in from the wrapper). States `scanning`, `syncing`, `sync-preparing`, `sync-waiting`, `scan-waiting`, `cleaning`, `clean-waiting` mean busy: exit 0 with "sources busy" in the report. `idle` proceeds. Any other state, a missing folder, or a failed query is a failure with a notification.
2. **Fast-forward the clone.** `git fetch`, then: if every commit in `origin/main..HEAD` is the publisher's own (`vault publish:` subject), discard them with `git reset --hard origin/main` and record the count (their content is recomputed from the sources; this covers a rejected push, including the CI manifest commit landing between fetch and push); if a local commit is not the publisher's, fail "unpushed local commit" or "remote diverged". Every git call has a timeout.
3. **Compose.** Rsync the Mac source into `published/` as-is. Rsync the BigRig source through the path map from `compose.yml` (today one entry: `01 Projects/The Penthouse/` to `01 Projects/Penthouse/`). Copy from `_attachments/` only PNG and SVG files that some note in the same source embeds. Never copy `_inbox/`, `.obsidian/`, `.trash/`, or files with extensions `json jsonl log csv py sh patch txt exit-code`. Deletion propagates: a file absent from every source is removed from `published/`, except protected paths: `.github/`, `.gitignore`, `README.md`, `garden-manifest.json`, `curation.yml`.
4. **Refuse collisions.** If two sources produce the same published path, fail and list every colliding path.
5. **Normalize BigRig frontmatter** in the composed copy only: add `machine: bigrig`; set `publish: true` when absent; set `title` from the first H1 when absent; drop `featured_candidate`. Keep every other key. Mac notes are not touched. Notes with no frontmatter get the minimum block (`tags: []`, `created: <file mtime date>`, `publish: true`).
6. **Apply `curation.yml`** (Section 6). It wins over frontmatter for the keys it sets.
7. **Fix links.** Embeds by bare filename (`![[fleet-pareto.png]]`) are rewritten to the full published path when exactly one file with that name exists in the published tree; ambiguous or missing targets are left as they are and listed in the report. Wikilinks and embeds whose target is a file excluded in step 3 are unwrapped to their display text.
8. **Copy `curation.yml`** into `published/curation.yml` so the overrides are versioned.
9. **Gate, commit, push.** Fail first if the privacy terms file is missing or empty (`--require-terms`). `git add -A`, run `.github/scripts/privacy-gate.py` on the index. On a hit: `git reset`, write the report, raise an Unraid notification, exit 1. Otherwise commit `vault publish: <date> (m5pro N notes, bigrig M notes)` and push with the deploy key. An empty diff is a no-op with "nothing to publish" in the report.

CI regenerates `garden-manifest.json` exactly as today.

### 5.3 Empty-source guard

Before step 3, count Markdown notes in each source. If a source folder is missing or holds fewer than half the notes of the last successful run (stored in `last-run.md`), fail "source looks empty" without composing.

### 5.4 Reporting

Every run writes `vault/last-run.md`: timestamp, status, per-source note counts, files added, changed, removed, unresolved embeds, unwrapped links, gate result, commit hash, duration. Failures also call `/usr/local/emhttp/webGui/scripts/notify -i warning -s "vault publish" -d "<reason>"`.

### 5.5 `compose.yml`

```yaml
published: /vault/published
sources:
  - name: m5pro
    path: /sources/m5pro
    machine: mac
  - name: bigrig
    path: /sources/bigrig
    machine: bigrig
    path_map:
      "01 Projects/The Penthouse/": "01 Projects/Penthouse/"
    attachments: _attachments
protected: [".github/", ".gitignore", "README.md", "garden-manifest.json", "curation.yml"]
exclude_dirs: ["_inbox", ".obsidian", ".trash"]
exclude_ext: ["json", "jsonl", "log", "csv", "py", "sh", "patch", "txt", "exit-code"]
image_ext: ["png", "svg", "jpg", "jpeg", "gif", "webp"]
exclude_files: [".stignore"]
syncthing_api: http://127.0.0.1:8384   # publisher container runs with --network host; Unraid's Syncthing uses host networking
```

## 6. Curation and tiers (approved Section 3)

### 6.1 `curation.yml`

A list of entries keyed by published path:

```yaml
- path: "01 Projects/Strata/Strata RTX 3060 Optimization Showcase.md"
  featured: 2
  summary: "Tuning a home GPU to answer huge prompts 16.6% faster, proven with paired tests, plus the follow-up experiment that honestly failed."
```

Keys: `featured` (integer), `summary` (string, at most 160 characters), `publish` (bool). Validation in the compose job: unknown path, duplicate rank within the file, or a rank that collides with a Mac note's frontmatter `featured` fails the run and names the clash. Mac featured notes get `summary` in their frontmatter, written in the plan. BigRig notes get theirs from this file.

### 6.2 Tiers

| Tier | Rank | Where it shows |
|---|---|---|
| Featured | 1 to 10 | The strip on the garden page (cap raised from 7 to 10 in `garden-terminal.js`, `featuredLimit`) |
| Useful | 11 and up | Gallery, in rank order, ahead of everything else |
| Archive | none | Gallery after the ranked notes, newest first; published and indexable |

### 6.3 The featured ten

1. The Penthouse Rebuild Knowledge Hub (Mac, `01 Projects/Penthouse/00 - Knowledge Hub.md`)
2. Strata RTX 3060 Optimization Showcase (BigRig)
3. Reliability Fix Log (Mac)
4. Building a Beast: TrueNAS SAS Server for $270 (Mac, `02 Homelab/Guides/TrueNAS Build Guide.md`)
5. Pi-hole Migration: RPi B+ to RPi 5 NVMe (Mac)
6. Unraid Server Hardware Swap: B660M and 12600KF Transplant (Mac, `02 Homelab/Session Notes/2026-06-20 Unraid Hardware Swap ASRock B660M.md`)
7. Strata V100 setup and benchmarks (BigRig)
8. Philosopher Project (BigRig)
9. Portfolio Website, Current State (Mac)
10. Thinking flips the ranking, v4 results (BigRig)

Hardware builds take four of ten slots per owner decision 5. Reliability Fix Log and Strata showcase were swapped from the first draft so the Penthouse overall note leads.

### 6.4 The useful tier

Opens at 11 with the remaining hardware and operations notes: Unraid Pool Recovery, Server Inventory, Rig Fleet specs (BigRig), GPU crash and Vulkan pinning (BigRig), Dual Tesla P100 vs second 9060 XT (BigRig), Raspberry Pi B+ utility node (BigRig). Then the benchmark and software notes: Matched Qwen 27B vs Flash DeepSWE2, LLM Benchmark Registry, WAN instability log, Model Benchmarks hub (after its correction lands), MASSIVE-RIG, Privacy-First Obsidian Publishing System, Backend Hardening Checklist, Architecture in Plain English, Flash-Next llama.cpp audit, RAFT Laya Router, Flash-Next effort sweep, Prometheus and Grafana lessons, DNS Loop, Unraid LLM Serving Throughput, Obsidian Vault Git Sync.

The final order of the useful tier comes from the full read in the plan: cheaper agents read one folder each of the Mac vault and nominate notes that pass one test, "could a stranger with the same problem use this without the rest of the vault", with the reason and the single most concrete fact. The controller judges, assigns ranks, and writes a one-line summary for every ranked note. Expected size 30 to 50 notes.

Held back from the strip although hardware: Budget SAS Drive NAS Build Guide (212 words of conversation scaffolding) and the Teardown Cafe TrueNAS Build Entry (duplicates the $270 build for another site).

Not ranked: the four BigRig per-model notes with contradictory verdicts, generated ReBench pages, `_attachments` reports, index and MOC notes, session logs.

## 7. Mac cutover (approved Section 4)

Order matters: Unraid publishes successfully before the Mac stops, and the Mac stops before Unraid's next run. Step 2 of the compose job (fast-forward or fail) covers the overlap window.

1. Prepare the `vault` share (Section 4.1): move the disk4 remainder to cache, set exclusive, add the container mount, move the BigRig folder data and path. Confirm the BigRig folder returns to idle with 79 notes and no "locally changed" items.
2. Add the `m5pro-vault` folder on both sides through the Syncthing APIs with the Section 4.2 ignores. Wait for the first sync. Confirm the Markdown count on Unraid equals the Mac's minus `_private/`.
3. Set up Unraid: build `vault-publisher`, generate an ed25519 deploy key at `/root/.ssh/vault-deploy`, register it on the public repo with write access (via `gh api repos/AIMDaAlien/Obsidian-Vault/keys`; if the token lacks the scope, the owner adds it on the website), clone the repo into `vault/published`, write `curation.yml` and `compose.yml`, install `publish.sh`, the Dockerfile, and the cron entry.
4. Dry run with push disabled (`--no-push`). The diff must show only: BigRig notes and embedded charts added, `machine: bigrig` keys, featured ranks and summaries, unwrapped evidence links, rewritten embeds, and nothing removed from the Mac side. Gate green. Any other change stops the cutover.
5. First real publish from Unraid. CI green. Manifest lists both vaults; featured count 10.
6. Retire Mac publishing, with Obsidian closed: disable the obsidian-git plugin in `.obsidian/community-plugins.json`, `launchctl unload` and delete `~/Library/LaunchAgents/com.aim.vault-sync.plist`, move the vault's `.git/` and `.github/` to the scratchpad as `mac-vault-git-archive-<date>/`. Reopen Obsidian. The Mac vault is plain files from here on.
7. Watch two cycles: edit a Mac note, confirm it reaches `sources/m5pro`, is published within 15 minutes, and shows the new `updated` date in the manifest. Repeat with a BigRig note after the owner edits one.

Rollback before step 6 is doing nothing. After step 6, restoring the archived `.git` and re-enabling the plugin returns the old path; the archive is kept for a week.

## 8. Failure handling and testing (approved Section 5)

Rule: when unsure, publish nothing and say why. Failures that stop a run: sources busy (exit 0, retry next cycle), source missing or looks empty (Section 5.3), path collision, invalid `curation.yml` (including absolute or `..` paths and duplicate paths), privacy terms file missing, Syncthing error state or unreachable API, gate hit, a local non-publisher commit, git timeout, container or image missing, missing host secret file. Syncthing's own metadata (`.stignore`, `.stfolder/`, `.stversions/`) is always excluded from composition. Every outcome is written to `last-run.md`; every failure raises an Unraid notification.

Unit tests for `compose.py` run against two fixture vaults under `.github/scripts/tests/fixtures/compose/{m5pro,bigrig}/`, covering: path map, collision detection, frontmatter normalization, curation application and validation (unknown path, duplicate rank, rank clash with frontmatter), bare-embed resolution (unique, ambiguous, missing), evidence-link unwrapping, attachment selection (embedded PNG copied, un-embedded PNG and all JSON skipped), protected files surviving deletion, deletion propagation, the empty-source guard, and `summary` length. They run with `python -m unittest discover` in the same container, and in CI alongside the gate's tests. The dry run of Section 7 step 4 is the integration test.

## 9. Portfolio changes in this spec

- `garden-terminal.js`: `featuredLimit` from 7 to 10.
- Nothing else. Rendering `summary` on cards, cross-vault link resolution, and the graph belong to the garden code spec.

## 10. BigRig corrections (handed off)

The brief given to the owner's BigRig agent on 2026-10-18 covers: Model Benchmarks header, the four per-model notes, Maya V100 preflight, v3 design and v3 results notes (plus a missing H1), Rig Hardware and Display current configuration, the port map in two index notes, and an intro for MASSIVE-RIG. Append-only, dated callouts under the H1, `updated: 2026-10-17`, redaction conventions, no git. The compose job picks the results up through Syncthing.

## 11. Gaps and out of scope

- No mini PC build note exists in either vault. The fleet is described in the Mac's Server Inventory and the BigRig's Rig Fleet specs. A dedicated note is a writing task for the owner.
- No "what is Strata" overview exists; the showcase stands in. Swarm Dashboard and the BigRig Penthouse Remake have logs but no overview.
- The two stray vault copies under the Mac's `Documents/Notes/` are untouched.
- The `syncthing` share still spans two disks behind FUSE for the general backup; consolidation recommended.
- Garden code: `summary` on cards, link resolution by title and path across both vaults, tag cleanup, bare-filename embeds not fixed by the compose job, DOMPurify with SRI, lazy manifest, the graph, AGENTS.md section 7. Next spec.

## 12. Outcome (2026-10-18)

| Item | Result |
|---|---|
| Code | `composelib/` + `compose.py` + `.github/unraid/*` on `AIMDaAlien/Obsidian-Vault` main (17 commits, then 4 follow-ups); 186 tests; CI green |
| Hub | `/mnt/cache/vault/{sources/m5pro,sources/bigrig,published,curation.yml,compose.yml,last-run.md,logs}`; wrapper and Dockerfile under `/mnt/cache/appdata/vault-publisher/bin` (root-only, outside the container's write reach); terms copy beside it |
| Syncthing | `m5pro-vault` Mac send-only → Unraid receive-only; `omarchy-vault` repointed to the cache hub; container recreated with `/mnt/cache/vault:/vault` |
| First publish | 50c80e8: m5pro 371 notes, bigrig 79 notes, 91 files added (70 BigRig notes, 9 MOCs, 21 charts), `.stignore` removed |
| Curation | 82 ranked (strip 1-10 per Section 6.3, useful 11-82), summaries on all; 65 Mac notes via frontmatter, 17 BigRig via `curation.yml`; empty BigRig stub unpublished |
| Mac cutover | launchd job and obsidian-git removed; `.git`/`.github` archived in the session scratchpad for a week; vault is plain files |
| Watch | BigRig cycle: new note + 5 charts published by the 17:15 and 17:30 cron runs unattended. Mac cycle: edit at 17:10, on Unraid 17:30 (slow first delivery), published 17:45, live on main 17:46 |
| Gate | Two new rules (first-octet-0 quads, 10-digit numbers in code spans) after three false positives on BigRig notes; `--require-terms` enforces the owner's private terms list |

Deviations from the text above, all ruled during execution: stale-lock breaking replaced by a hard timeout (5.1, 8); publisher-only local commits are discarded and recomposed instead of failing (5.2 step 2); Syncthing non-idle states other than scanning/syncing are failures (5.2 step 1); the wrapper lives outside `/mnt/cache/vault` (4.1 shows `bin/` under the hub); `exclude_files` and the always-excluded Syncthing metadata (5.5, 8); `_private` in `exclude_dirs`. Known follow-ups: the exclusive-share bind for `/mnt/user/vault` never appeared (pipeline does not need it); a `.git/*.lock` left by a killed git call would block runs until removed by hand; the first Mac delivery took 20 minutes, watch the Mac Syncthing link.
