# Vault Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a sanitized, restructured copy of the Obsidian vault, publish it as a fresh public repo with a permanent privacy gate, and swap it into the live vault in one sitting.

**Architecture:** A throwaway Python migrator in the scratchpad copies the live vault to a staging folder and applies, in order: delete list, rename map, consolidated freeCodeCamp notes, link rewrite, frontmatter normalization, redaction, section stripping, index generation, and an overlay of the permanent repo files. Two permanent stdlib-only scripts (privacy gate, manifest generator) ship in the new repo with unittest tests. Cutover renames the old repo to a private archive, creates the new public repo under the old name, and replaces the live vault's git history with one commit.

**Tech Stack:** Python 3.14 (PyYAML for the migrator only; permanent scripts are stdlib), `unittest` (pytest is not installed locally; tests are pytest-compatible), `gh` 2.101, openrsync, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-16-vault-restructure-design.md`

## Global Constraints

- Live vault `~/Documents/Notes/Obsidian Notes Vault` is READ-ONLY for every task except Task 12. Subagents never write there.
- Work directory `$WORK` = `/private/tmp/claude-501/-Users-aim-Documents-Projects-First-Portfolio-Iteration/vault-migration`. Everything throwaway lives there. It survives sessions but not a reboot; Tasks 11 and 12 must run without a reboot in between, or Task 11 is rerun.
- Secret values (WAN IPs, phone, customer names, admin username) live only in `$WORK/inputs/redaction_table.json` and are never pasted into any file under the portfolio repo or the new vault repo. The plan refers to them by audit item number in `~/Documents/Projects/Portfolio Audit 2026-10-15/report-privacy.md`.
- Permanent repo artifacts are stdlib-only Python: `privacy-gate.py`, `generate-manifest.py`, their tests. No third-party imports.
- Frontmatter schema and key order (spec 4.1): `title, summary, tags, created, updated, publish, featured, machine, engine, project, status, repository`. Removed keys: `published, published_to_garden, visibility, garden_path, last_published, privacy_scan, archived_from, modified`.
- Dates are `YYYY-MM-DD` strings.
- New repo `.gitignore` is exactly: `_private/`, `.obsidian/`, `.DS_Store`, `*.tmp`.
- Wikilink syntax preserved: `[[target]]`, `[[target|alias]]`, `[[target#heading]]`, `![[embed|size]]`.
- Placeholders are exactly those in spec 5.1.
- Commit author email in the new repo: `AIMDaAlien@users.noreply.github.com`.

## Plan-level decisions the spec left open

- `History.md` and `Command Types.md` land in `05 Linux and Systems/Fundamentals/` (not at the `05` root), with the 13 loose notes from `Linux/Linux/` and `Operating Systems Overview.md`, because the spec forbids loose notes at a numbered root.
- Only `Homelab Bridge Note.md` becomes an index (`02 Homelab/Homelab Index.md`). The other four Bridges describe Teardown Cafe and move to `01 Projects/Teardown Cafe/` unchanged in name.
- Embeds whose target file does not exist (186 `Pasted image` targets) become `<!-- embed removed: <name> (file not in vault) -->` so the filename survives without a broken render.
- The 15 featured notes are forced to `publish: true` even when the old `visibility` was private or review.
- `02 Homelab/Session Notes/2025-10-01 Uptime Kuma Attempt & Career Path Analysis.md` is renamed `2025-10-01 Uptime Kuma Attempt.md` after the career sections are stripped.
- Missing per-folder index notes (03, 04, 05, 07) are generated; existing ones (01 Projects Index, 06 Learning Journals Index, Teardown and Tech Consulting indexes) are kept.
- The privacy gate reads an optional local file `~/.vault-privacy-terms` (one literal per line) so the Mac-side runs can flag the customer names and admin username without those strings entering the repo.

## Review Focus

1. A wikilink whose basename exists in two folders after migration (`99 - Current Handoff` x7, `Project - Current State` x3, `Current Directory` x2) must resolve to the same-folder note, else stay unchanged and be reported, never silently rewritten to the wrong note. Test in Task 5.
2. An IPv4 inside a code fence or table cell, or followed by `:port`, must still be redacted; an IPv4 followed by `/nn` (CIDR) or preceded within 20 chars by "firmware" or "version" must not. Test in Tasks 4 and 8.
3. A frontmatter block with a `tags:` list in block form, a date already quoted, or a Windows line ending must round-trip without losing keys. Test in Tasks 1 and 9.
4. A note that is both `visibility: private` and in the featured list must end `publish: true, featured: N`. Test in Task 3.
5. The privacy gate run with a `--base-ref` of all zeros (first push) must not crash and must still scan files. Test in Task 8.

---

### Task 1: Workspace, fixture vault, and `vaultlib.py`

**Files:**
- Create: `$WORK/migrator/vaultlib.py`
- Create: `$WORK/migrator/tests/fixtures/mini-vault/` (6 notes, built in Step 1)
- Test: `$WORK/migrator/tests/test_vaultlib.py`

**Interfaces:**
- Produces: `read_note(path) -> tuple[dict, str]` (frontmatter dict or `{}`, body text after the closing `---`); `write_note(path, fm: dict, body: str)` writes frontmatter in schema key order, then any other keys, then `---`, then body; `walk_notes(root) -> list[str]` relative `.md` paths, skipping `.git`, `.obsidian`, `.stfolder`, `.github`, `_private`; `WIKILINK = re.compile(r'(!?)\[\[([^\]|#]+)(#[^\]|]+)?(\|[^\]]+)?\]\]')`; `SCHEMA_ORDER` list.
- `read_note` must tolerate the invalid block `tags: []` followed by `- item` lines by treating the list items as the tags value (this is the Privacy-First note).

- [ ] **Step 1: Create the workspace and fixture vault**

```bash
mkdir -p "$WORK"/{migrator/tests/fixtures/mini-vault,inputs,repo-files,bundles,drafts}
```
Fixture notes (write each with a heredoc): `01 Projects/Demo/A.md` (valid fm, inline tags `[x, y]`, body with `[[B]]`, `[[Old/B|alias]]`, `![[Pasted image 1.png]]`, a trailing `#Web #css` line); `01 Projects/Demo/B.md` (block-form tags, `visibility: private`, `published: true`); `02 Homelab/C.md` (no frontmatter, body contains `192.168.0.120:8080`, `firmware 20.00.06.00`, `10.0.0.0/8`); `03 AI/Invalid.md` (the `tags: []` + list-items block copied in shape from the Privacy-First note); `04 Programming/Steps/Step 1.md` and `Step 2.md` (one snippet each, trailing `#Web`); `images/keep.png` (empty file).

- [ ] **Step 2: Write the failing tests**

```python
class TestReadWrite(unittest.TestCase):
    def test_inline_tags_parse(self): fm,_ = read_note(FX/'01 Projects/Demo/A.md'); self.assertEqual(fm['tags'], ['x','y'])
    def test_block_tags_parse(self): fm,_ = read_note(FX/'01 Projects/Demo/B.md'); self.assertEqual(fm['tags'], ['b1','b2'])
    def test_invalid_block_recovers_tags(self): fm,_ = read_note(FX/'03 AI/Invalid.md'); self.assertEqual(fm['tags'], ['mcp','obsidian'])
    def test_no_frontmatter(self): fm,body = read_note(FX/'02 Homelab/C.md'); self.assertEqual(fm, {}); self.assertTrue(body.startswith('#'))
    def test_roundtrip_order(self): write to tmp with keys given in reverse order; re-read; assert key order == SCHEMA_ORDER filtered to present keys, and dates remain 'YYYY-MM-DD' strings
    def test_crlf_roundtrip(self): write a note with \r\n endings; read_note returns same keys
    def test_walk_skips_private(self): create tmp vault with `_private/x.md` and `a.md`; walk_notes returns ['a.md']
    def test_wikilink_regex(self): assert WIKILINK.findall('see [[B]] and ![[img.png|300]] and [[Old/B#h|al]]') == [('', 'B', '', ''), ('!', 'img.png', '', '|300'), ('', 'Old/B', '#h', '|al')]
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `cd $WORK/migrator && python3 -m unittest tests.test_vaultlib -v`
Expected: FAIL, `ModuleNotFoundError: vaultlib`

- [ ] **Step 4: Implement `vaultlib.py`**

`read_note`: split on the first `\n---` after a leading `---`; try `yaml.safe_load`; on `yaml.YAMLError`, apply the recovery: find a line `^tags:\s*\[\]\s*$` directly followed by `^- ` lines, rewrite to a block list, retry. Convert `datetime.date`/`datetime` values to `YYYY-MM-DD` strings. Normalize `\r\n` to `\n` on read.
`write_note`: `yaml.safe_dump(ordered, sort_keys=False, allow_unicode=True, default_flow_style=None)`; tags are emitted inline (`[a, b]`).

- [ ] **Step 5: Run tests, verify they pass**

Run: `python3 -m unittest tests.test_vaultlib -v`
Expected: 8 passed.

No commit: `$WORK` is not a git repo. Each task ends with its tests green; that is the checkpoint.

---

### Task 2: Rename map and delete list

**Files:**
- Create: `$WORK/migrator/rename_rules.py`
- Test: `$WORK/migrator/tests/test_rename_rules.py`

**Interfaces:**
- Produces: `build_rename_map(rel_paths: list[str]) -> dict[str, str]` (old relative path to new relative path, for every file whose path changes, including images and non-md under moved folders); `build_delete_list(rel_paths) -> list[str]`; `FCC_SOURCES: dict[str, str]` mapping the 5 source folders to their output note path (spec 6.1, with the 05 outputs under `Fundamentals/`); `machine_engine_for(new_path) -> tuple[str|None, str|None]`.
- A path in the delete list never appears in the rename map.

- [ ] **Step 1: Write the failing tests** (one assertion per rule below, using literal old paths from the live tree)

```python
RULES = {
 '01 Projects/The Penthouse/04 - Reliability Fix Log.md': '01 Projects/Penthouse/04 - Reliability Fix Log.md',
 '01 Projects/The Penthouse/Repo Archive/Research 01 - Table Stakes.md': '01 Projects/Penthouse/Repo Archive/Research 01 - Table Stakes.md',
 '01 Projects/The Penthouse Self-Hosting/03 - Backend Hardening Checklist.md': '01 Projects/Penthouse/Self-Hosting/03 - Backend Hardening Checklist.md',
 '01 Projects/Teardown Cafe/Sessions/2025-10-21 Cursor Session.md': '01 Projects/Teardown Cafe/Session Notes/2025-10-21 Cursor Session.md',
 '01 Projects/Archive/Teardown Documentation Lessons.md': '01 Projects/Teardown Cafe/Documentation/Teardown Documentation Lessons.md',
 '01 Projects/Portfolio Website/docs/CSS Breakpoint Strategy.md': '01 Projects/Portfolio Website/CSS Breakpoint Strategy.md',
 '01 Projects/Portfolio Website Development/Deployment/Github Pages Setup.md': '01 Projects/Portfolio Website/Github Pages Setup.md',
 '01 Projects/Portfolio Website Development/Portfolio Website Development Index.md': '01 Projects/Portfolio Website/Portfolio Website Development Index.md',
 '01 Projects/Archive/Knowledge Garden - Sidebar Implementation Session.md': '01 Projects/Portfolio Website/Knowledge Garden - Sidebar Implementation Session.md',
 '01 Projects/Archive/Tag System & Portfolio Integration.md': '01 Projects/Portfolio Website/Tag System & Portfolio Integration.md',
 '01 Projects/Tech Consulting/Tech Consultation Playbook/Design System/Material 3 Expressive - Core Principles.md': '01 Projects/Tech Consulting/Tech Consultation Playbook/Material 3 Expressive - Core Principles.md',
 '01 Projects/Homelab NOC Skills/Prometheus Grafana Stack.md': '02 Homelab/Session Notes/Prometheus Grafana Stack.md',
 '01 Projects/Life/00 - Life Idea.md': '_private/00 - Life Idea.md',
 '01 Projects/Archive/TrueNAS Build Guide.md': '02 Homelab/Guides/TrueNAS Build Guide.md',
 '01 Projects/Archive/Budget SAS Drive NAS Build Guide.md': '02 Homelab/Guides/Budget SAS Drive NAS Build Guide.md',
 '01 Projects/Archive/Pi-hole Migration - RPi B+ to RPi 5 NVMe.md': '02 Homelab/Guides/Pi-hole Migration - RPi B+ to RPi 5 NVMe.md',
 '01 Projects/Archive/Pi-hole Setup Guide - Complete Journey.md': '02 Homelab/Guides/Pi-hole Setup Guide - Complete Journey.md',
 '01 Projects/Archive/Pi-hole TrueNAS Network Conflict Troubleshooting.md': '02 Homelab/Guides/Pi-hole TrueNAS Network Conflict Troubleshooting.md',
 '01 Projects/Archive/WireGuard VPN Setup.md': '02 Homelab/Guides/WireGuard VPN Setup.md',
 '01 Projects/Archive/GrapheneOS Migration Guide - Complete Documentation.md': '07 Tools and Workflow/GrapheneOS Migration Guide - Complete Documentation.md',
 '01 Projects/Archive/Claude-Cursor Workflow.md': '07 Tools and Workflow/Claude-Cursor Workflow.md',
 '02 Homelab/Home Lab/02 - Network Map.md': '02 Homelab/Overview/02 - Network Map.md',
 '02 Homelab/BigRig TUF X670E BIOS Configuration.md': '02 Homelab/Reference/BigRig TUF X670E BIOS Configuration.md',
 '02 Homelab/Storage Cleanup and TM Backup Decisions.md': '02 Homelab/Reference/Storage Cleanup and TM Backup Decisions.md',
 '02 Homelab/Session Notes/2025-10-01 Uptime Kuma Attempt & Career Path Analysis.md': '02 Homelab/Session Notes/2025-10-01 Uptime Kuma Attempt.md',
 '01 Projects/Sovereign AI Stack/Qwen3.8-27B.md': '03 AI and Local Models/Mac - MLX/Qwen3.8-27B.md',
 '01 Projects/Sovereign AI Stack/Gemma 4 12B QAT Q4.md': '03 AI and Local Models/Mac - MLX/Gemma 4 12B QAT Q4.md',
 '03 AI and Local Models/Local AI Stack Research - Gemma 4 on M5 Pro.md': '03 AI and Local Models/Mac - MLX/Local AI Stack Research - Gemma 4 on M5 Pro.md',
 '01 Projects/Sovereign AI Stack/Deepwen-3.6.md': '03 AI and Local Models/Unraid - llama.cpp/Deepwen-3.6.md',
 '01 Projects/Sovereign AI Stack/Frontier Landscape - What Fits 128GB.md': '03 AI and Local Models/Unraid - llama.cpp/Frontier Landscape - What Fits 128GB.md',
 '01 Projects/Sovereign AI Stack/Unraid Qwen3.6 Terminal Agent - July 2026.md': '03 AI and Local Models/Unraid - llama.cpp/Unraid Qwen3.6 Terminal Agent - July 2026.md',
 '03 AI and Local Models/Unraid LLM Serving Throughput.md': '03 AI and Local Models/Unraid - llama.cpp/Unraid LLM Serving Throughput.md',
 '03 AI and Local Models/K2-Horizon MoVA Serving and Benchmarks.md': '03 AI and Local Models/Unraid - llama.cpp/K2-Horizon MoVA Serving and Benchmarks.md',
 '01 Projects/Sovereign AI Stack/Setup Tutorial - Sovereign AI Stack.md': '03 AI and Local Models/Unraid - Ollama/Setup Tutorial - Sovereign AI Stack.md',
 '01 Projects/Sovereign AI Stack/Speed Myth - Ollama vs Text-Gen-WebUI.md': '03 AI and Local Models/Unraid - Ollama/Speed Myth - Ollama vs Text-Gen-WebUI.md',
 '01 Projects/Sovereign AI Stack/LLM Benchmark Registry - Mac vs Unraid.md': '03 AI and Local Models/Benchmarks/LLM Benchmark Registry - Mac vs Unraid.md',
 '03 AI and Local Models/Local AI Benchmark Content Site.md': '03 AI and Local Models/Benchmarks/Local AI Benchmark Content Site.md',
 '05 Linux and Systems/Linux/Linux/Quoting/Backslash.md': '05 Linux and Systems/Quoting/Backslash.md',
 '05 Linux and Systems/Linux/Linux/Managing Files and Directories/File Globiing/Asterisk.md': '05 Linux and Systems/File Globbing/Asterisk.md',
 '05 Linux and Systems/Linux/Linux/Bash.md': '05 Linux and Systems/Fundamentals/Bash.md',
 '05 Linux and Systems/Operating Systems Overview.md': '05 Linux and Systems/Fundamentals/Operating Systems Overview.md',
 '05 Linux and Systems/Linux/Linux/Linux File Permissions 1.md': '05 Linux and Systems/Linux File Permissions/Linux File Permissions Overview.md',
 '05 Linux and Systems/Linux/Linux/Command HIstory/History.md': '05 Linux and Systems/Fundamentals/History.md',
 '05 Linux and Systems/Linux/Linux/Command Types/Command Types.md': '05 Linux and Systems/Fundamentals/Command Types.md',
 '06 Learning Journals/Learning Journals/Privacy Hardening Journey.md': '06 Learning Journals/Privacy Hardening Journey.md',
 '07 Tools and Workflow/Bridges/Homelab Bridge Note.md': '02 Homelab/Homelab Index.md',
 '07 Tools and Workflow/Bridges/Payments & Billing Bridge.md': '01 Projects/Teardown Cafe/Payments & Billing Bridge.md',
 '01 Projects/Local Language Engine/Assets/Majlis - Switch On.png': '01 Projects/Local Language Engine/Assets/Majlis - Switch On.png',  # unchanged: NOT in map
}
DELETED = ['04 Programming/Programming Concepts/Python/CS50_s Introduction to Computer Science.md',
 '04 Programming/Programming Concepts/C/Data Types in C/int.md', '04 Programming/Programming Concepts/General Programming/Compilation.md',
 '04 Programming/Programming Concepts/Computer Science Concepts.md', '04 Programming/Programming Concepts/Programming Concepts Index.md',
 '04 Programming/Programming Concepts/Web Development.md', '04 Programming/Programming Concepts/HTML/Build CatPhotoApp/Step 9.md',
 '04 Programming/Programming Concepts/CSS/CSS Colored Markers/Meta Elements.md', '05 Linux and Systems/Linux/Linux/Command HIstory/Step 1.md',
 '05 Linux and Systems/Linux/Linux/Command Types/Aliases.md', '05 Linux and Systems/Linux/Linux/Command Types/which.md',
 '07 Tools and Workflow/Personal Setup.md', 'images/LG-G8-fastboot-wrong-identity.png', 'images/LG-G8-qfil-sahara-failure.png',
 'images/LG-G8-kdztools-extraction.png', 'garden-manifest.json']
```
Tests: `test_rules` iterates RULES (unchanged entry asserts key absent); `test_deleted`; `test_disjoint` (no overlap); `test_count_04_deleted` asserts exactly 39 `.md` files under `04 Programming` outside the three freeCodeCamp folders (`Build CatPhotoApp`, `Build a Cafe Menu`, `CSS Colored Markers`) are deleted when fed the real path list from `find`; `test_machine_engine` asserts `('mac','mlx')` for a `Mac - MLX/` path, `('unraid','llama.cpp')` for `Unraid - llama.cpp/`, `('unraid','sglang')` for the Qwen3.6 Terminal Agent note, `('unraid','ollama')`, `('mac','mlx')` for `Local Language Engine/`, `(None, None)` for `Benchmarks/` and everything else.

- [ ] **Step 2: Run tests, verify they fail**

Run: `python3 -m unittest tests.test_rename_rules -v`. Expected: FAIL, module missing.

- [ ] **Step 3: Implement `rename_rules.py`**

Ordered rule list, first match wins: explicit single-file table (Archive destinations, 03 AI and Sovereign per-file table, Bridges, career note, `Linux File Permissions 1`, `Personal Setup`), then folder prefix rules (`The Penthouse Self-Hosting/` to `Penthouse/Self-Hosting/`, `The Penthouse/` to `Penthouse/`, `Teardown Cafe/Sessions/` to `Session Notes/`, `Portfolio Website/docs/` and `Portfolio Website Development/**` flatten to `Portfolio Website/`, `Tech Consultation Playbook/**` flatten one level, `Homelab NOC Skills/` to `02 Homelab/Session Notes/`, `Life/` to `_private/`, `Home Lab/` to `Overview/`, `Linux/Linux/Managing Files and Directories/File Globiing/` to `File Globbing/`, `Linux/Linux/<Topic>/` to `<Topic>/`, `Linux/Linux/<file>` to `Fundamentals/<file>`, `Learning Journals/Learning Journals/` up one). Delete list = all `.md` under `04 Programming` plus `05 .../Command HIstory/Step *.md`, `Command Types/Step *.md`, the five named Command Types notes (`Aliases, External Commands, Functions In Linux, Internal Commands, which`), `Personal Setup.md`, the image list (the two edl files are decided in Task 11 Step 2 and appended there), `garden-manifest.json`. Note: `Command HIstory/History.md` and `Command Types/Command Types.md` are renamed, not deleted; Task 10 overwrites their content. Colored Markers' 6 named notes are deleted because `04 Programming/**` is.

- [ ] **Step 4: Run tests, verify they pass**

Run: `python3 -m unittest tests.test_rename_rules -v`. Expected: all pass.

- [ ] **Step 5: Dry-run against the live tree and record counts**

Run: `cd "$HOME/Documents/Notes/Obsidian Notes Vault" && find . -type f -not -path './.git/*' -not -path './.obsidian/*' -not -path './.stfolder/*' | sed 's|^\./||' | sort > "$WORK/inputs/live_paths.txt"` then `python3 -c "from rename_rules import *; p=open('$WORK/inputs/live_paths.txt').read().split('\n'); m=build_rename_map(p); d=build_delete_list(p); print(len(m),'renamed',len(d),'deleted')"`.
Expected: deleted count is 39 + 127 (freeCodeCamp inputs minus the two renamed notes `History.md` and `Command Types.md`) + 1 (`Personal Setup.md`) + 3 (images) + 1 (`garden-manifest.json`) = 171 at this point (the edl images come later). Record the renamed count in the plan's progress notes.

---

### Task 3: Frontmatter normalization

**Files:**
- Create: `$WORK/migrator/frontmatter.py`
- Create: `$WORK/inputs/featured.json` (15 new-path strings in spec 4.4 order)
- Test: `$WORK/migrator/tests/test_frontmatter.py`

**Interfaces:**
- Consumes: `machine_engine_for` from Task 2; `read_note`/`write_note` from Task 1.
- Produces: `normalize(fm: dict, body: str, new_path: str, created_lookup: dict[str,str], featured: list[str]) -> tuple[dict, str]` returning the new frontmatter and the body with hashtag-only lines removed; `HASHTAG_LINE = re.compile(r'^\s*(#[\w/-]+\s*)+$')`.

- [ ] **Step 1: Write the failing tests**

```python
def test_publish_from_published_to_garden(self): fm={'published_to_garden': False,'published': True}; assert normalize(fm,'',P,{},[])[0]['publish'] is False
def test_publish_from_published(self): fm={'published': True}; -> publish True
def test_publish_from_visibility_private(self): fm={'visibility':'private'} -> False;  'review' -> False; 'public' -> True
def test_publish_default_true(self): fm={} -> True
def test_featured_forces_publish(self): fm={'visibility':'private'}; out=normalize(fm,'',FEATURED[4],{},FEATURED)[0]; assert out['publish'] is True and out['featured']==5
def test_removed_keys_gone(self): for k in REMOVED: assert k not in out
def test_repository_kept(self): fm={'repository':'x'} -> out['repository']=='x'
def test_created_from_lookup(self): fm={} , created_lookup={P:'2025-03-01'} -> out['created']=='2025-03-01'
def test_created_kept_and_truncated(self): fm={'created':'2024-11-28 16:30:00'} -> '2024-11-28'
def test_hashtag_lines_fold(self): fm={'tags':['a']}; body='# T\n\n#Web #css\n\ntext\n#Web\n'; out,b=normalize(...); assert out['tags']==['a','web','css'] and '#Web' not in b and '# T' in b
def test_machine_engine_set(self): P='03 AI and Local Models/Mac - MLX/X.md' -> machine 'mac', engine 'mlx'; a `02 Homelab` path has neither key
def test_project_set(self): '01 Projects/Penthouse/Self-Hosting/X.md' -> project 'Penthouse'
def test_no_updated_written(self): assert 'updated' not in out
def test_minimum_block(self): fm={} -> out has 'tags': [] and 'publish': True, and nothing else except 'created' when the lookup has it
def test_key_order(self): list(out) == [k for k in SCHEMA_ORDER if k in out]
```

- [ ] **Step 2: Run tests, verify they fail.** Expected: module missing.

- [ ] **Step 3: Implement `frontmatter.py`**

`publish` precedence exactly as spec 4.2. `created` falls back to `created_lookup.get(new_path)`, else today's date is NOT used: leave absent and let Task 7 report it. Tags are lowercased, deduplicated, order preserved. `project` is the folder directly under `01 Projects/`. `featured` is `featured.index(new_path) + 1` when present.

- [ ] **Step 4: Run tests, verify they pass.** Expected: 15 passed.

- [ ] **Step 5: Write `$WORK/inputs/featured.json`** with the 15 post-migration paths:

```
01 Projects/Penthouse/Self-Hosting/03 - Backend Hardening Checklist.md
01 Projects/Penthouse/04 - Reliability Fix Log.md
02 Homelab/Session Notes/2026-01-20 Network Troubleshooting Log - Intermittent WAN Instability.md
01 Projects/Penthouse/Self-Hosting/00 - Index.md
01 Projects/Penthouse/Self-Hosting/12 - Unraid Pool Recovery 2026-08-04.md
02 Homelab/Guides/Pi-hole Migration - RPi B+ to RPi 5 NVMe.md
02 Homelab/Session Notes/2026-01-09 Troubleshooting DNS Loop.md
07 Tools and Workflow/Building a Privacy-First Obsidian Publishing System.md
07 Tools and Workflow/Obsidian Vault Git Sync.md
01 Projects/Portfolio Website/Project - Current State.md
01 Projects/Penthouse/02 - Architecture in Plain English.md
02 Homelab/Reference/Prometheus Grafana Monitoring Stack - Lessons Learned.md
03 AI and Local Models/Benchmarks/LLM Benchmark Registry - Mac vs Unraid.md
02 Homelab/Guides/TrueNAS Build Guide.md
03 AI and Local Models/Unraid - llama.cpp/Unraid LLM Serving Throughput.md
```

---

### Task 4: Redaction engine and section stripping

**Files:**
- Create: `$WORK/migrator/redact.py`, `$WORK/migrator/strip_sections.py`
- Create: `$WORK/inputs/redaction_table.json`
- Test: `$WORK/migrator/tests/test_redact.py`

**Interfaces:**
- Produces: `class Redactor: __init__(table: dict); apply(text: str, rel_path: str) -> tuple[str, list[tuple[str,str]]]` (new text, list of (pattern_name, original_value)); `lan_ip_numbering: dict[str,int]` assigned by sorting all distinct RFC1918 values found across the vault before any apply (two-pass: `collect(texts)` then `apply`); `strip_sections(text: str, headings: list[str]) -> str` removes each heading line and everything up to the next heading of equal or higher level.
- `redaction_table.json` shape: `{"wan_ips": [...3 values...], "phone": "...", "customers": {"<customer-A>": "...", "<customer-B>": "..."}, "admin_user": "...", "line_removals": [{"file": "01 Projects/Penthouse/2025-02-13 Session Notes.md", "contains": "sshpass"}], "section_strips": {"02 Homelab/Session Notes/2025-10-01 Uptime Kuma Attempt.md": ["## Career Path Analysis Completed", "### Career Direction", "### Personality Testing", "### Career Planning", "### Career Development (Ongoing)"]}}`. Values come from report-privacy.md items 3, 4, 5, 10. Keep this file out of every repo.

- [ ] **Step 1: Write the failing tests** (use fake values in tests: WAN `203.0.113.7`, phone `(571) 555-0199`, names `Jane Roe`)

```python
def test_lan_ip_stable_numbering(self): r.collect(['a 192.168.0.120 b 192.168.0.145','c 192.168.0.120']); assert r.apply('x 192.168.0.145 y 192.168.0.120','f')[0]=='x <lan-ip-2> y <lan-ip-1>'
def test_lan_ip_with_port_and_in_table(self): '| 192.168.0.120:8080 |' -> '| <lan-ip-1>:8080 |'
def test_cidr_untouched(self): '10.0.0.0/8 and 192.168.0.0/24' unchanged
def test_allowlisted_untouched(self): '127.0.0.1 1.1.1.1 192.168.1.1 172.17.0.1 216.198.79.1' unchanged
def test_version_string_untouched(self): 'firmware 20.00.06.00' and 'version 2.1.0.52' unchanged; also '1.16.0.3' (octet>255 impossible here, so test leading-zero rule with '20.00.06.00')
def test_wan_ip(self): table wan -> '<wan-ip>'
def test_mac(self): '02:00:00:aa:bb:cc' -> '<mac>'
def test_duckdns_and_tsnet(self): 'x.duckdns.org' -> '<ddns-host>'; 'macbook-pro.tail0000.ts.net' -> '<tailnet-host>'
def test_phone(self): table phone in '(571) 555-0199' and '571-555-0199' forms -> '<phone>'; '555-123-4567' unchanged
def test_customers(self): 'Jane Roe' -> '<customer-A>'; case-insensitive
def test_home_paths(self): '/Users/aim/Documents' -> '~/Documents'; r'C:\Users\Aim\Downloads' -> '~/Downloads'
def test_root_at(self): 'root@192.168.0.120' -> '<user>@<host>' (and not '<user>@<lan-ip-1>')
def test_env_path(self): '/mnt/cache/appdata/penthouse/app/infra/compose/.env.unraid' -> '<env-path>'; '.../.env.unraid.backup-2026' -> '<env-path>'
def test_admin_user(self): table admin value as a whole word -> '<admin-user>'; not inside a longer token
def test_private_deployment(self): 'https://corne.<owner-handle>.chatgpt.site/x' -> '<private-deployment>'
def test_tailscale_line_removed(self): 'a\nvisit https://login.tailscale.com/a/abc now\nb' -> 'a\nb'
def test_line_removal_scoped(self): sshpass line removed only when rel_path matches the table entry
def test_strip_sections(self): text with '## Keep\n..\n## Career Path Analysis Completed\n### Path 1\n..\n## Technical\n..' -> Career block and its ### children gone, '## Technical' kept
def test_strip_h3_only(self): '### Career Direction\n..\n### Technical Learning\n..' -> only first removed
def test_hits_reported(self): apply returns [('lan_ip','192.168.0.120'), ...]
```

- [ ] **Step 2: Run tests, verify they fail.**

- [ ] **Step 3: Implement**

IPv4 regex `(?<![\d.])((?:\d{1,3}\.){3}\d{1,3})(?![\d.])`; a match is a candidate only if every octet is 0-255 with no leading zero on multi-digit octets, is not followed by `/\d`, and the 20 chars before it do not contain `firmware` or `version` (case-insensitive). RFC1918 = `10.`, `172.16-31.`, `192.168.`. Allowlist set from spec 5.3. Any other valid candidate not in the allowlist is `<wan-ip>` only if listed in `table.wan_ips`; otherwise it is left and reported as `unknown_public_ip` so Task 11 can review it. Apply order: line removals, `root@` rule, env paths, home paths, tailnet, duckdns, MAC, phone, customers, admin user, private deployment, WAN, LAN. Strip sections is a separate function called by the orchestrator for the paths in `section_strips`.

- [ ] **Step 4: Run tests, verify they pass.** Expected: 21 passed.

- [ ] **Step 5: Build `redaction_table.json`** from report-privacy.md items 3, 4, 5, 10 and the two scoped rules above. Verify: `python3 -c "import json;t=json.load(open('$WORK/inputs/redaction_table.json'));print(len(t['wan_ips']), len(t['customers']))"` prints `3 2`.

---

### Task 5: Link rewriter and embed handling

**Files:**
- Create: `$WORK/migrator/links.py`
- Test: `$WORK/migrator/tests/test_links.py`

**Interfaces:**
- Consumes: `WIKILINK` from Task 1; rename map and delete list from Task 2.
- Produces: `class Resolver: __init__(new_tree: list[str], rename_map: dict, delete_list: list[str], aliases: dict[str, str|None])`; `resolve(target: str, from_path: str) -> tuple[str, str|None]` returning `(action, new_target)` with action in `keep`, `rewrite`, `unwrap`, `broken`; `rewrite_links(text: str, from_path: str, resolver) -> tuple[str, list[tuple[str,str,str]]]` (text, list of (action, old_target, new_target)); `ALIASES` constant; `fix_embeds(text, existing_files: set[str], deleted_files: set[str], from_path) -> tuple[str, list[str]]`.

Resolution order for a non-embed target, after stripping leading and trailing whitespace: (1) if `target` ends with a basename found exactly once in the new tree, use that basename; (2) if found more than once, prefer the one in the same folder as `from_path`, then the one under the same top-level numbered folder, else `broken`; (3) if `target` or `target` with `.md` is a key of the rename map (old path or old `folder/basename`), use the new basename; (4) if in `ALIASES`, use the alias value, `None` meaning `unwrap`; (5) if the target names a note in the delete list, `unwrap`; (6) else `broken`. `keep` when the resolved basename equals the original target text. Rewrites always emit the bare basename (Obsidian resolves by basename), preserving `#heading` and `|alias`. `unwrap` replaces `[[X|alias]]` with `alias` and `[[X]]` with `X`.

```python
ALIASES = {
 'Knowledge Base - Main Index': 'Index', 'Systems/README': 'Index', 'Projects/README': 'Index',
 'Teardown Cafe - Design System': 'Design System', 'Teardown Cafe - Troubleshooting': 'Troubleshooting', 'Teardown Cafe - Project Overview': 'Project Overview',
 '08 - Privacy & Security Hardening': None, 'Product Photography Workflow': None, 'opencode-qwen-deepseek-setup': None,
 '21 - Unraid Production Operations': '13 - Unraid Production Operations',
 'unraid-qwen38-notes': 'Qwen3.8-Flash-Next 262K Context on Unraid',
 'Payments & Billing': 'Payments & Billing Bridge', 'Homelab Bridge Note': 'Homelab Index', 'Homelab Bridge': 'Homelab Index',
 'Linux File Permissions 1': 'Linux File Permissions Overview',
 '08 - Storage Implementation': None, '09 - UI Components Guide': None, '10 - Deployment Guide': None, '11 - User Guide': None,
 'CS50 Linux (': None,
}
```
Step-file targets (`Step 12` from a freeCodeCamp folder) map to the consolidated note of the folder that `from_path` or the rename map places them in: add rule (3b) using `FCC_SOURCES` from Task 2.

- [ ] **Step 1: Write the failing tests**

```python
TREE = ['01 Projects/Demo/A.md','01 Projects/Demo/99 - Current Handoff.md','01 Projects/Other/99 - Current Handoff.md','Index.md','01 Projects/Teardown Cafe/Documentation/Troubleshooting.md','05 Linux and Systems/Fundamentals/History.md']
def test_unique_basename_keep(self): resolve('A', '01 Projects/Demo/B.md') == ('keep','A')
def test_path_prefix_stripped(self): rewrite_links('[[Programming/A|see]]', ...) -> '[[A|see]]'
def test_leading_space(self): '[[ Knowledge Base - Main Index]]' -> '[[Index]]'
def test_ambiguous_same_folder(self): resolve('99 - Current Handoff','01 Projects/Demo/A.md') == ('keep','99 - Current Handoff'); from '02 Homelab/x.md' -> ('broken', None) and text unchanged
def test_alias_rewrite(self): '[[Teardown Cafe - Troubleshooting#Sec|T]]' -> '[[Troubleshooting#Sec|T]]'
def test_alias_unwrap(self): 'see [[08 - Privacy & Security Hardening|hardening]] now' -> 'see hardening now'; '[[Product Photography Workflow]]' -> 'Product Photography Workflow'
def test_deleted_unwrap(self): delete_list has '04 Programming/Programming Concepts/Python/Python Functions.md'; '[[Programming/Python Functions]]' -> 'Python Functions'
def test_step_to_consolidated(self): '[[Step 3]]' from a CatPhotoApp path -> '[[HTML Fundamentals - CatPhotoApp]]'
def test_broken_reported(self): '[[Nope]]' unchanged, report contains ('broken','Nope',None)
def test_embed_missing_becomes_comment(self): '![[Pasted image 2023.png]]' -> '<!-- embed removed: Pasted image 2023.png (file not in vault) -->'
def test_embed_existing_kept(self): existing={'images/keep.png'}; '![[keep.png|300]]' unchanged; also 'Assets/Majlis - Switch Off.png\|260' (escaped pipe inside a table) unchanged when the file exists
def test_embed_deleted_image(self): deleted image -> '*screenshot removed: showed workstation identifiers*'
```

- [ ] **Step 2: Run tests, verify they fail.**
- [ ] **Step 3: Implement `links.py`** per the resolution order above. Embeds: target basename looked up in `existing_files` by basename or by path suffix; deleted images (from Task 2's delete list) get the italic line from spec 5.4; otherwise the HTML comment.
- [ ] **Step 4: Run tests, verify they pass.** Expected: 12 passed.

---

### Task 6: Index notes, root Index.md, Redaction Conventions

**Files:**
- Create: `$WORK/migrator/indexes.py`
- Create: `$WORK/repo-files/Redaction Conventions.md`
- Test: `$WORK/migrator/tests/test_indexes.py`

**Interfaces:**
- Produces: `generate_folder_index(root, folder: str, title: str) -> str` returning the relative path written; `generate_root_index(root) -> str`; `INDEX_TARGETS = {'03 AI and Local Models': 'AI and Local Models Index.md', '04 Programming': 'Programming Index.md', '05 Linux and Systems': 'Linux and Systems Index.md', '07 Tools and Workflow': 'Tools and Workflow Index.md'}`.

Folder index content: frontmatter (`tags: [index]`, `created: <today>`, `publish: true`), `# <Title>`, one line of intro, then per subfolder a `## <Subfolder>` heading with a bullet `[[basename]]` per note, and a `## Notes` section for loose notes. Root `Index.md`: frontmatter `publish: true`, `# Index`, for each top-level folder a `## <folder>` with its subfolders as bullets and a `-- see [[<index note basename>]]` suffix when an index note exists in that folder. `_private/`, `images/`, `Assets/` are not listed.

`Redaction Conventions.md`: frontmatter (`tags: [meta, privacy]`, `created: 2026-10-16`, `publish: true`), a one-paragraph explanation that this vault is public and identifiers are replaced in place, then a table with every placeholder from spec 5.1 and one sentence on what it stands for, then a sentence that `<lan-ip-N>` numbering is stable across the vault so `<lan-ip-1>` always means the same machine, then a sentence that some lines (device-enrollment URLs, credential-bearing commands) were removed outright. No real values anywhere in this file.

- [ ] **Step 1: Write the failing tests**

```python
def test_folder_index_lists_notes(self): build tmp tree '03 AI and Local Models/Mac - MLX/X.md','.../Benchmarks/Y.md'; path=generate_folder_index(tmp,'03 AI and Local Models','AI and Local Models Index'); text=read; assert '## Mac - MLX' in text and '- [[X]]' in text and '- [[Y]]' in text and path.endswith('AI and Local Models Index.md')
def test_folder_index_skips_itself_and_private(self): index note not listed under Notes; '_private' never listed
def test_root_index(self): generate_root_index(tmp); text has '## 03 AI and Local Models', '- Mac - MLX/', 'see [[AI and Local Models Index]]', no 'images/'
def test_redaction_conventions_has_all_placeholders(self): for p in ['<lan-ip-N>','<wan-ip>','<mac>','<ddns-host>','<tailnet-host>','<phone>','<customer-A>','<customer-B>','~','<user>@<host>','<env-path>','<admin-user>','<private-deployment>']: assert p in open(REPO_FILES/'Redaction Conventions.md').read()
```

- [ ] **Step 2: Run tests, verify they fail.**
- [ ] **Step 3: Implement `indexes.py` and write `Redaction Conventions.md`.**
- [ ] **Step 4: Run tests, verify they pass.** Expected: 4 passed.

---

### Task 7: Migrator orchestrator and census

**Files:**
- Create: `$WORK/migrator/migrate.py`, `$WORK/migrator/census.py`, `$WORK/migrator/created_dates.py`
- Test: `$WORK/migrator/tests/test_migrate.py` (runs the whole pipeline on the fixture vault)

**Interfaces:**
- Consumes: everything from Tasks 1 to 6.
- Produces: `python3 migrate.py --source <live vault> --staging $WORK/staging --inputs $WORK/inputs --overlay $WORK/repo-files --overlay $WORK/inputs/new-notes --report $WORK/report.json`; `python3 census.py $WORK/staging` printing `notes N, publish_true N, featured N, broken_links N (list), missing_created N (list), unknown_public_ip N (list), duplicate_basenames N (list)` and exiting 0; `python3 created_dates.py <live vault> <live_paths.txt> > $WORK/inputs/created_dates.json` mapping OLD relative path to first-commit date via `git log --diff-filter=A --follow --format=%as -- <path> | tail -1`, run read-only against the live clone.

Pipeline order inside `migrate.py`: (1) `rm -rf staging`, rsync source to staging excluding `.git/`, `.obsidian/`, `.stfolder/`, `.DS_Store`; (2) delete list; (3) rename map (create dirs, move files, remove emptied dirs); (4) overlays copied in (repo files, then new notes, later wins); (5) build the new tree list and `existing_files`; (6) for every `.md` not under `_private/`: read, `fix_embeds`, `rewrite_links`, `normalize` frontmatter (created lookup keyed by old path, translated through the rename map), `strip_sections` if listed, `Redactor.apply` (two-pass: collect first over all bodies), write; (7) `_private/` notes are left byte-identical; (8) generate folder indexes and root Index; (9) write `report.json` with per-stage counts, every `broken` link as `(from, target)`, every redaction hit count by pattern, `unknown_public_ip` occurrences, notes missing `created`.

- [ ] **Step 1: Write the failing test**

```python
def test_pipeline_on_fixture(self):
    run migrate.main([...fixture as source...]); staging = tmp
    assert not exists(staging/'04 Programming/Steps/Step 1.md')
    fmA,bodyA = read_note(staging/'01 Projects/Demo/A.md')
    assert fmA['publish'] is True and 'web' in fmA['tags'] and 'css' in fmA['tags'] and '#Web' not in bodyA
    assert '<!-- embed removed: Pasted image 1.png' in bodyA and '[[B]]' in bodyA and '[[Old/B|alias]]' not in bodyA and '[[B|alias]]' in bodyA
    fmC,bodyC = read_note(staging/'02 Homelab/C.md'); assert '<lan-ip-1>:8080' in bodyC and 'firmware 20.00.06.00' in bodyC and '10.0.0.0/8' in bodyC and fmC['publish'] is True
    report = json.load(open(report_path)); assert report['redactions']['lan_ip'] == 1 and report['broken_links'] == []
    assert exists(staging/'Redaction Conventions.md') and exists(staging/'Index.md')
```
Plus `test_census_output_fields` asserting the printed keys.

- [ ] **Step 2: Run test, verify it fails.**
- [ ] **Step 3: Implement `migrate.py`, `census.py`, `created_dates.py`.** `census.py` recomputes broken links independently of the migrator (walk, extract targets, resolve by basename only) so it is a real check, not a replay of the report.
- [ ] **Step 4: Run all migrator tests.** Run: `python3 -m unittest discover -s tests -v`. Expected: all pass.
- [ ] **Step 5: Generate created dates from the live clone (read-only)**

Run: `python3 created_dates.py "$HOME/Documents/Notes/Obsidian Notes Vault" "$WORK/inputs/live_paths.txt" > "$WORK/inputs/created_dates.json"`.
Expected: JSON with one entry per `.md` path; `python3 -c "import json;d=json.load(open('$WORK/inputs/created_dates.json'));print(len(d), sum(1 for v in d.values() if v))"` prints two numbers, the second at least 500.

- [ ] **Step 6: First full dry run against the live vault**

Run: `python3 migrate.py --source "$HOME/Documents/Notes/Obsidian Notes Vault" --staging "$WORK/staging" --inputs "$WORK/inputs" --overlay "$WORK/repo-files" --report "$WORK/report.json" && python3 census.py "$WORK/staging"`.
Expected: exit 0. Record `broken_links` (must be below 209), `unknown_public_ip` list (review each: add to allowlist in `redact.py` or to `wan_ips`), `missing_created` list (expect only new overlay notes). The freeCodeCamp output notes do not exist yet, so the 5 consolidated paths are reported broken; that resolves after Task 10. Confirm `git -C "$HOME/Documents/Notes/Obsidian Notes Vault" status --porcelain` is unchanged by this run.

---

### Task 8: Privacy gate (permanent)

**Files:**
- Create: `$WORK/repo-files/.github/scripts/privacy-gate.py`
- Create: `$WORK/repo-files/.github/hooks/pre-commit`
- Test: `$WORK/repo-files/.github/scripts/tests/test_privacy_gate.py`, fixtures under `tests/fixtures/gate/`

**Interfaces:**
- Produces: `PATTERNS: list[tuple[str, re.Pattern]]` named `lan_ip, public_ip, mac, tailscale_auth, duckdns, ts_net, phone, private_key, tskey, github_token, aws_key, discord_webhook, home_path, sshpass, env_unraid, private_deployment, extra_term`; `is_allowlisted(value: str, line: str) -> bool`; `scan_text(text: str, path: str, extra_terms: list[str]) -> list[tuple[str,int,str]]` (path, 1-based line, pattern name); `tracked_text_files(repo_root) -> list[str]` via `git ls-files` filtered to extensions `.md .txt .json .yml .yaml .sh .py .css .js .html .base .svg`; `new_images(repo_root, base_ref: str|None) -> list[str]` (image extensions `.png .jpg .jpeg .gif .webp .svg`); `load_extra_terms(path=~/.vault-privacy-terms) -> list[str]`; `main(argv) -> int` with `--base-ref REF` and `--root PATH`.
- Exit 1 prints `path:line: pattern` per hit then `privacy gate: N hits`. Exit 0 prints `privacy gate: clean, N files`. New images print `review image: path` and never change the exit code. A `base_ref` of all zeros or an unknown ref is treated as `None`.
- IPv4 validity, CIDR skip, firmware/version skip, and allowlist are identical to Task 4; copy the constants (this file must stay stdlib-only and independent of the migrator).

- [ ] **Step 1: Write the failing tests**

Fixtures: `clean.md` (allowlisted IPs, example.com, `/home/sysadmin`, `555-123-4567`, `firmware 20.00.06.00`, `10.0.0.0/8`); one file per pattern class, each containing exactly one hit (`lan.md` with `192.168.0.120`, `public.md` with `203.0.113.9`, `mac.md`, `tailscale.md` with `https://login.tailscale.com/a/abc`, `duckdns.md`, `tsnet.md`, `phone.md` with `(571) 555-0199`, `key.md` with `-----BEGIN RSA PRIVATE KEY-----`, `tskey.md`, `ghp.md` with `ghp_` + 36 chars, `akia.md`, `discord.md`, `home.md` with `/Users/aim/x`, `sshpass.md`, `env.md` with `/x/.env.unraid`, `deploy.md` with `a.<owner-handle>.chatgpt.site`).

```python
def test_clean_has_no_hits(self): assert scan_text(read('clean.md'),'clean.md',[]) == []
def test_each_pattern_once(self): for name,file in CASES: hits=scan_text(read(file),file,[]); assert [h[2] for h in hits]==[name], file
def test_extra_terms(self): scan_text('met Jane Roe today','x.md',['Jane Roe']) == [('x.md',1,'extra_term')]
def test_line_numbers(self): text='ok\nok\n192.168.0.5\n' -> line 3
def test_main_exit_codes(self): init a tmp git repo with clean.md committed -> main(['--root',tmp])==0; add lan.md, `git add` -> main==1 and stdout contains 'lan.md:1: lan_ip'
def test_untracked_ignored(self): untracked lan.md (not added) -> main==0
def test_new_images_staged(self): git add new.png -> new_images(tmp, None)==['new.png']
def test_new_images_base_ref(self): commit new.png; new_images(tmp,'HEAD~1')==['new.png']; new_images(tmp,'0000000000000000000000000000000000000000')==[] without raising
def test_pre_commit_hook_runs_gate(self): hook file is executable and its content invokes privacy-gate.py
```

- [ ] **Step 2: Run tests, verify they fail.** Run: `cd $WORK/repo-files/.github/scripts && python3 -m unittest discover -s tests -v`.
- [ ] **Step 3: Implement `privacy-gate.py` and the hook**

Hook content:
```sh
#!/bin/sh
exec python3 "$(git rev-parse --show-toplevel)/.github/scripts/privacy-gate.py"
```
`chmod +x`.

- [ ] **Step 4: Run tests, verify they pass.** Expected: 9 passed.
- [ ] **Step 5: Run the gate against the staging copy from Task 7**

Run: `cd "$WORK/staging" && git init -q && git add -A && python3 .github/scripts/privacy-gate.py; echo exit=$?; rm -rf .git`.
Expected: `exit=0` apart from hits that Task 7 Step 6 already listed as `unknown_public_ip`. Any other hit is a redaction gap: fix it in Task 4's table or rules, rerun Task 7 Step 6, repeat until clean. (The `~/.vault-privacy-terms` file is created in Task 11 Step 4; this run does not use it.)

---

### Task 9: Manifest generator, workflow, sync script, gitignore

**Files:**
- Create: `$WORK/repo-files/.github/scripts/generate-manifest.py` (rewrite of the live one; start from a copy)
- Create: `$WORK/repo-files/.github/scripts/generate-manifest.sh` (copy unchanged from live)
- Create: `$WORK/repo-files/.github/scripts/vault-auto-sync.sh`
- Create: `$WORK/repo-files/.github/workflows/generate-manifest.yml`
- Create: `$WORK/repo-files/.gitignore`
- Test: `$WORK/repo-files/.github/scripts/tests/test_generate_manifest.py`

**Interfaces:**
- Produces: `parse_frontmatter(text: str) -> tuple[dict, str]` (stdlib parser: scalars, `true/false/null`, quoted strings, inline lists `[a, b]`, block lists under a key, integers for `featured`); `extract_title(fm, body, filename) -> str` (frontmatter title, else first H1, else filename stem); `extract_links(body) -> list[str]`; `git_last_commit_date(repo_root, rel_path) -> str|None` using `git log -1 --format=%cs -- <path>`; `build_manifest(repo_root) -> dict` with keys `generated_at, tree, metadata, links` unchanged in shape; each metadata entry contains every parsed frontmatter key plus `title` and `updated` (frontmatter `updated` wins, else git date, else absent); `.base` files excluded from `tree`; summary line `Manifest generated: F files, D dirs, P publishable notes, L links across N notes` where P counts `publish is True`.

- [ ] **Step 1: Write the failing tests**

Fixtures under `tests/fixtures/manifest/`: `inline.md` (`tags: [a, b]`, `featured: 3`, `publish: true`, `title: Custom`, H1 `# Other`), `block.md` (block-list tags, no title, H1 present), `none.md` (no frontmatter, no H1), `quoted.md` (`created: '2025-01-02'`, `updated: 2026-02-03`), `skip.base`, `_private/p.md`, `.gitignore` containing `_private/`.

```python
def test_inline_list_and_int(self): fm,_=parse_frontmatter(read('inline.md')); assert fm['tags']==['a','b'] and fm['featured']==3 and fm['publish'] is True
def test_block_list(self): fm['tags']==['x','y']
def test_title_precedence(self): extract_title(inline)=='Custom'; extract_title(block)==its H1; extract_title(none)=='none'
def test_quoted_date_string(self): fm['created']=='2025-01-02' and fm['updated']=='2026-02-03'
def test_build_manifest_tree(self): m=build_manifest(FX); paths=[e['path'] for e in m['tree']]; assert 'skip.base' not in paths and '_private/p.md' not in paths and 'inline.md' in paths
def test_updated_from_git(self): tmp git repo, commit a.md with GIT_COMMITTER_DATE=2026-01-05; build_manifest -> metadata['a.md']['updated']=='2026-01-05'; a note with frontmatter updated keeps its own value
def test_updated_absent_without_git(self): build_manifest(FX) (not a git repo) -> 'updated' not in metadata['inline.md']
def test_summary_counts_publish(self): captured stdout of main([FX]) contains 'publishable notes'
```

- [ ] **Step 2: Run tests, verify they fail.**
- [ ] **Step 3: Implement the generator; write the four other files**

`vault-auto-sync.sh`: `VAULT="$HOME/Documents/Notes/Obsidian Notes Vault"`; after the pull block and before `git add -A`, insert `python3 .github/scripts/privacy-gate.py >>"$LOG" 2>&1 || { echo "$(date '+%F %T') privacy gate failed, not committing" >>"$LOG"; exit 1; }`.

`generate-manifest.yml`: same triggers and permissions; steps: checkout with `fetch-depth: 0`; `python3 -m unittest discover -s .github/scripts/tests`; `python3 .github/scripts/privacy-gate.py --base-ref "${{ github.event.before }}"`; `bash .github/scripts/generate-manifest.sh`; the existing commit step.

`.gitignore`: the four lines from Global Constraints.

- [ ] **Step 4: Run tests, verify they pass.** Run: `python3 -m unittest discover -s tests -v`. Expected: 17 passed (Tasks 8 and 9 together).
- [ ] **Step 5: Run the generator on staging**

Run: `python3 "$WORK/repo-files/.github/scripts/generate-manifest.py" "$WORK/staging" && python3 -c "import json;m=json.load(open('$WORK/staging/garden-manifest.json'));print(sum(1 for v in m['metadata'].values() if v.get('publish') is True),'publish',sum(1 for v in m['metadata'].values() if 'featured' in v),'featured')"`.
Expected: featured prints 15 (after Task 10, when all featured notes exist). Then `rm "$WORK/staging/garden-manifest.json"` (Task 11 regenerates it inside the git repo).

---

### Task 10: freeCodeCamp and Linux consolidation (one-shot)

**Files:**
- Create: `$WORK/migrator/fcc_bundle.py`
- Create: `$WORK/bundles/<five>.md`, `$WORK/drafts/<five>.md`
- Create: `$WORK/inputs/new-notes/04 Programming/Web Fundamentals/{HTML Fundamentals - CatPhotoApp, CSS Fundamentals - Cafe Menu, CSS Colors and Box Model - Colored Markers}.md`, `$WORK/inputs/new-notes/05 Linux and Systems/Fundamentals/{History, Command Types}.md`
- Test: `$WORK/migrator/tests/test_fcc_bundle.py`

**Interfaces:**
- Consumes: `FCC_SOURCES` from Task 2; `read_note` from Task 1.
- Produces: `order_files(folder) -> list[str]` (Step N by integer N; named notes by the order they are first linked from other notes in the folder, then alphabetical); `write_bundle(folder, out_path)` writing `### <basename>` sections with each note's body.

- [ ] **Step 1: Write the failing tests**

```python
def test_step_order_numeric(self): ['Step 10.md','Step 2.md','Step 1.md'] -> ['Step 1.md','Step 2.md','Step 10.md']
def test_named_order_by_links(self): fixture folder where 'Command Types.md' links [[Internal Commands]] then [[External Commands]]; order starts ['Command Types.md','Internal Commands.md','External Commands.md'] and the unlinked note comes last alphabetically
def test_bundle_has_all_sections(self): bundle for fixture Steps folder contains '### Step 1' and '### Step 2' in order
```

- [ ] **Step 2: Run tests, verify they fail.** **Step 3: Implement.** **Step 4: Run tests, verify they pass.**

- [ ] **Step 5: Write the five bundles from the live vault (read-only)**

Run `write_bundle` for each key of `FCC_SOURCES` into `$WORK/bundles/`. Expected: five files; `grep -c '^### ' bundle` prints 69, 42, 6, 4 (3 steps + History), 10 for the five.

- [ ] **Step 6: Dispatch five sonnet subagents in parallel, one per bundle**

Each prompt contains: the bundle path (read it, write nothing outside `$WORK/drafts/`), the output path in `$WORK/drafts/`, and this contract verbatim: "Write one Markdown note. First line after the frontmatter: a credit line naming the freeCodeCamp course (`Responsive Web Design` for the three web notes; for the two Linux notes, no credit line, say the material is personal course notes) with a link to https://www.freecodecamp.org/learn/. Then `# <title>`. Group content into themed `##` sections, never by step number. Preserve every step's explanation as prose. Show code only when a new element, property, or command first appears. End with a `## Complete result` section holding the final full code from the last step (for the Linux notes, a reference table of every command covered). Frontmatter exactly: `tags: [<html|css|linux>, freecodecamp]` (Linux notes: `[linux, shell]`), `created: <earliest created date seen in the bundle, else 2024-01-01>`, `publish: true`. Keep the note under 2500 words for the two large tutorials." Titles: `HTML Fundamentals - CatPhotoApp`, `CSS Fundamentals - Cafe Menu`, `CSS Colors and Box Model - Colored Markers`, `Command History`, `Command Types`.

- [ ] **Step 7: Review each draft against its bundle (main model)**

For each draft: walk the bundle's sections and tick off each step's concept in the draft; confirm the final code block equals the last step's result; confirm no `Step N` text survives; confirm the frontmatter matches. Fix in place or send the draft back to its subagent with the specific gaps. Accept by copying to the `$WORK/inputs/new-notes/` path. For `History.md` and `Command Types.md`, the new-notes overlay overwrites the renamed originals.

- [ ] **Step 8: Rerun the migrator and census**

Run Task 7 Step 6's command with the extra `--overlay "$WORK/inputs/new-notes"`. Expected: the 5 consolidated paths are no longer in `broken_links`; `publish_true` and `featured 15` reported.

- [ ] **Step 9: Discard the bundles and drafts after Task 12 completes** (listed here so the deliverable is clear; executed in Task 12 Step 14).

---

### Task 11: Full staging run, census gates, owner spot-check

**Files:**
- Modify: `$WORK/migrator/rename_rules.py` (append the edl image decision)
- Create: `~/.vault-privacy-terms` (owner's Mac only; three lines: the two customer names and the admin username, copied from `redaction_table.json`)

- [ ] **Step 1: Owner pre-flight (OWNER)**: rotate the Local REST API key and certificate in Obsidian's Local REST API plugin settings. Confirm with the owner before continuing.
- [ ] **Step 2: Decide the edl images**: view `images/LG-G8-edl-laf-write-success.png` and `images/LG-G8-edl-usb3-timeout-error.png` with the Read tool. Any image showing a `DESKTOP-` hostname or `C:\Users\` path goes on the delete list in `rename_rules.py`; update `test_deleted` accordingly and rerun Task 2's tests.
- [ ] **Step 3: Full run**: Task 7 Step 6 command with both overlays. Then `python3 census.py "$WORK/staging"`.
  Gates, all must hold before continuing: `unknown_public_ip` is empty; `missing_created` is empty (generated notes carry their own `created`); `broken_links` below 209 (record the number); no `.md` remains under `04 Programming` except the three Web Fundamentals notes and `Programming Index.md`; `find "$WORK/staging" -name 'Step *.md'` prints nothing; `ls "$WORK/staging/_private"` shows `00 - Life Idea.md`.
- [ ] **Step 4: Write `~/.vault-privacy-terms`** and run the gate on staging exactly as Task 8 Step 5. Expected: `privacy gate: clean, N files`.
- [ ] **Step 5: Grep sanity on staging** (none may print anything): `grep -rIl 'login.tailscale.com/a/' staging`; `grep -rIl 'sshpass' staging`; `grep -rIl '/Users/aim' staging --exclude-dir=_private`; `grep -rIn '## Career Path Analysis' staging`; `grep -rIn -f <(python3 -c "import json;t=json.load(open('$WORK/inputs/redaction_table.json'));print('\n'.join(t['wan_ips']+[t['phone'],t['admin_user']]+list(t['customers'].values())))") staging --exclude-dir=_private`.
- [ ] **Step 6: Owner spot-check (OWNER)**: produce `$WORK/spotcheck.md` with: the census output; the rename count and delete count; the full `broken_links` list; and the full text of `02 Homelab/Overview/02 - Network Map.md`, `01 Projects/3D Print Shoppe/Customer Inquiries & Responses.md`, `04 Programming/Web Fundamentals/HTML Fundamentals - CatPhotoApp.md`, `03 AI and Local Models/Mac - MLX/Qwen3.8-27B.md` frontmatter, `02 Homelab/Session Notes/2025-10-01 Uptime Kuma Attempt.md`, `Index.md`, `Redaction Conventions.md`. Open it in Obsidian with `open -a Obsidian "$WORK/spotcheck.md"`. Wait for explicit approval. Any requested change is a rules change in Tasks 2 to 6, followed by rerunning Steps 3 to 6.

---

### Task 12: Cutover

All commands run by the implementer unless marked OWNER. Stop and report at the first failure; nothing before Step 7 touches the live vault.

- [ ] **Step 1 (OWNER):** Quit Obsidian. Pause the vault folder in the Syncthing web UI.
- [ ] **Step 2:** Verify: `pgrep -x Obsidian; echo "exit=$?"` prints `exit=1`. Verify the live vault is clean: `git -C "$HOME/Documents/Notes/Obsidian Notes Vault" status --porcelain` prints nothing (if it prints files, stop and ask the owner whether to push them first or accept they ride along in staging; if ride along, rerun Task 11 Step 3 first).
- [ ] **Step 3:** Snapshot the current live vault: `tar -czf "$WORK/live-before-cutover.tgz" -C "$HOME/Documents/Notes" "Obsidian Notes Vault"`. Expected: file exists, size above 10 MB.
- [ ] **Step 4:** Archive the old repo:
```bash
gh repo rename Obsidian-Vault-archive -R AIMDaAlien/Obsidian-Vault --yes
gh repo edit AIMDaAlien/Obsidian-Vault-archive --visibility private --accept-visibility-change-consequences
gh repo view AIMDaAlien/Obsidian-Vault-archive --json visibility,name -q '.name + " " + .visibility'
```
Expected last line: `Obsidian-Vault-archive PRIVATE`.
- [ ] **Step 5:** Create the new repo: `gh repo create AIMDaAlien/Obsidian-Vault --public --description "Knowledge garden vault, sanitized and public by design"`. Expected: URL printed. If this fails, rollback is `gh repo rename Obsidian-Vault -R AIMDaAlien/Obsidian-Vault-archive --yes` and `gh repo edit ... --visibility public`, then stop.
- [ ] **Step 6:** Build the initial commit inside staging first (so a failure here leaves the live vault untouched):
```bash
cd "$WORK/staging" && git init -q -b main
git config user.name AIMDaAlien && git config user.email AIMDaAlien@users.noreply.github.com
git config core.hooksPath .github/hooks
git add -A && python3 .github/scripts/privacy-gate.py && git commit -q -m "Initial sanitized vault"
python3 .github/scripts/generate-manifest.py . && git add garden-manifest.json && git commit -q -m "chore: generate garden-manifest.json"
git log --oneline | wc -l
```
Expected: gate clean; `2` commits; `git ls-files | grep -c '^_private/'` prints `0`; `git ls-files | grep -c '^.obsidian/'` prints `0`.
- [ ] **Step 7:** Swap into the live vault:
```bash
LIVE="$HOME/Documents/Notes/Obsidian Notes Vault"
mv "$LIVE/.git" "$WORK/old-git-backup"
rsync -a --delete --exclude '.obsidian/' --exclude '.stfolder/' "$WORK/staging/" "$LIVE/"
```
Expected: `ls -a "$LIVE"` shows `.git`, `.github`, `.gitignore`, `.obsidian`, `.stfolder`, `_private`, `Index.md`, `Redaction Conventions.md`, the seven numbered folders, `images`, `garden-manifest.json`, `README.md`, `Vault Index.base`; `git -C "$LIVE" status --porcelain` prints nothing.
- [ ] **Step 8:** Push: `git -C "$LIVE" remote add origin https://github.com/AIMDaAlien/Obsidian-Vault.git && git -C "$LIVE" push -u origin main`. Expected: `main -> main` with no error.
- [ ] **Step 9:** Verify the workflow and the public artifact: `sleep 20; RUN=$(gh run list -R AIMDaAlien/Obsidian-Vault -L1 --json databaseId -q '.[0].databaseId'); gh run watch "$RUN" -R AIMDaAlien/Obsidian-Vault --exit-status` (expected exit 0), then `curl -sf https://raw.githubusercontent.com/AIMDaAlien/Obsidian-Vault/main/garden-manifest.json | python3 -c "import json,sys;m=json.load(sys.stdin);print(len(m['tree']),'entries')"`. Expected: a count above 400.
- [ ] **Step 10:** Fix the launchd job: edit `~/Library/LaunchAgents/com.aim.vault-sync.plist` so the script path reads `/Users/aim/Documents/Notes/Obsidian Notes Vault/.github/scripts/vault-auto-sync.sh`; then `launchctl unload ~/Library/LaunchAgents/com.aim.vault-sync.plist && launchctl load ~/Library/LaunchAgents/com.aim.vault-sync.plist && launchctl start com.aim.vault-sync && sleep 5 && tail -3 /tmp/vault-sync.log`. Expected: no `exit 127`; either no output (clean tree) or a `synced:` line.
- [ ] **Step 11 (OWNER):** Resume the Syncthing folder. Reopen Obsidian. Confirm the vault opens, `Redaction Conventions.md` renders, and the obsidian-git status bar shows a clean state. Edit any note by one character, wait ten minutes, confirm `git -C "$LIVE" log -1 --format=%s` shows `vault backup:`.
- [ ] **Step 12:** Confirm the garden loads: open https://portfolio.penthouse.blog in a browser (owner) or `curl -sf https://api.github.com/repos/AIMDaAlien/Obsidian-Vault/contents/Index.md -o /dev/null && echo ok`. Expected: `ok`.
- [ ] **Step 13:** Portfolio repo housekeeping: delete `CONTINUATION-PROMPT-VAULT.md` from the portfolio working tree (it is gitignored; the continuation prompt says to delete it once the spec is committed). Record the final broken-link count and publish count in a short "Outcome" section appended to the spec, and commit the spec change.
- [ ] **Step 14:** Cleanup: `rm -rf "$WORK/bundles" "$WORK/drafts" "$WORK/migrator" "$WORK/inputs/redaction_table.json"`. Keep `$WORK/live-before-cutover.tgz` and `$WORK/old-git-backup` for one week, then the owner deletes them. Tell the owner the archive repo `AIMDaAlien/Obsidian-Vault-archive` still holds the old history and the old Local REST API key, and that it stays private.
