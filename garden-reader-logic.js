/**
 * Knowledge Garden reader logic.
 *
 * Pure functions with no DOM access: topic mapping, listability, title index,
 * wikilink rewriting, and deep-link paths. Loaded by garden-terminal.html as a
 * plain script (attaches to window.GardenReaderLogic) and by the node:test
 * suite via module.exports.
 */
(function () {
    'use strict';

    // Copy is in the owner's voice: lowercase, short, direct.
    const TOPICS = [
        { id: 'projects', label: 'projects', description: 'things i actually built, start to finish', folders: ['01 Projects'] },
        { id: 'homelab', label: 'homelab', description: 'the servers, the network, the upgrades, and the fixes when they broke', folders: ['02 Homelab'] },
        { id: 'ai', label: 'ai and local models', description: 'models on my own hardware, how i run them, and what i learned', folders: ['03 AI and Local Models'] },
        { id: 'benchmarks', label: 'benchmarks', description: 'the numbers: every model i tested and how it held up', folders: ['03 AI and Local Models/Benchmarks'] },
        { id: 'linux', label: 'linux and systems', description: 'command line notes and the code around them', folders: ['05 Linux and Systems', '04 Programming'] },
        { id: 'journals', label: 'learning journals', description: 'what i was figuring out, while i figured it out', folders: ['06 Learning Journals'] },
        { id: 'tools', label: 'tools and workflow', description: 'how the notes, the sync, and the publishing hang together', folders: ['07 Tools and Workflow'] },
    ];

    // One accent per topic. Mixes on a card come from accentStops, never from the sub-project.
    const TOPIC_COLORS = {
        projects: 'var(--terminal-blue)',
        homelab: 'var(--terminal-cyan)',
        ai: 'var(--terminal-green)',
        benchmarks: 'var(--terminal-orange)',
        linux: 'var(--terminal-magenta)',
        journals: 'var(--terminal-yellow)',
        tools: 'var(--md-sys-color-primary)',
    };
    const FALLBACK_COLOR = 'var(--md-sys-color-primary)';
    const MAX_STOPS = 3;
    const OWN_SHARE_FLOOR = 0.5;
    const STRIP_LIMIT = 10;
    // A benchmark tag counts like this many links toward the benchmarks colour.
    const BENCHMARK_TAG_WEIGHT = 2;

    function topicColor(id) {
        return TOPIC_COLORS[id] || FALLBACK_COLOR;
    }

    const HIDDEN_SEGMENTS = ['.obsidian', '.stfolder', '.DS_Store', '.gitignore', '.github', 'Myself', 'images', '_attachments', '00 Index'];
    const HIDDEN_ROOT_FILES = ['Index.md', 'README.md', 'Redaction Conventions.md', 'markdown practice.md'];

    function segments(path) {
        return String(path || '').split('/').filter(Boolean);
    }

    function stem(path) {
        const name = segments(path).pop() || '';
        return name.replace(/\.md$/i, '');
    }

    function isHiddenPath(path) {
        const segs = segments(path);
        if (segs.length === 0) return true;
        if (segs.some(s => s.startsWith('.') || HIDDEN_SEGMENTS.includes(s))) return true;
        if (segs.length === 1 && HIDDEN_ROOT_FILES.includes(segs[0])) return true;
        return false;
    }

    function isListable(path, meta) {
        if (!meta || meta.publish !== true) return false;
        return !isHiddenPath(path);
    }

    // The topic whose folder is the longest prefix of the path, and how many segments that folder spans.
    // A folder can be nested ('03 AI and Local Models/Benchmarks'), so the deeper match wins.
    function topicMatch(path) {
        const segs = segments(path);
        if (segs.length < 2 || isHiddenPath(path)) return null;
        let best = null;
        for (const topic of TOPICS) {
            for (const folder of topic.folders) {
                const parts = folder.split('/');
                if (parts.length >= segs.length) continue;
                if (parts.every((part, i) => segs[i] === part) && (!best || parts.length > best.depth)) {
                    best = { topic, depth: parts.length };
                }
            }
        }
        return best;
    }

    function topicForPath(path) {
        const match = topicMatch(path);
        return match ? match.topic : null;
    }

    // Spellings that mean the same tag on different machines fold into one.
    const TAG_ALIASES = {
        benchmarks: 'benchmark',
        benchmarking: 'benchmark',
        bench: 'benchmark',
        'llama-cpp': 'llama.cpp',
        models: 'model',
        network: 'networking',
        'self-hosted': 'self-hosting',
        tooling: 'tools',
        versions: 'versioning',
    };

    function normalizeTag(tag) {
        const t = String(tag ?? '').trim().replace(/^#+/, '').toLowerCase();
        return TAG_ALIASES[t] || t;
    }

    function tagsOf(meta) {
        const raw = meta && meta.tags;
        const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
        const out = [];
        for (const tag of list) {
            const t = normalizeTag(tag);
            if (t && !out.includes(t)) out.push(t);
        }
        return out;
    }

    function isBenchmarkTagged(meta) {
        return tagsOf(meta).includes('benchmark');
    }

    function rankOf(meta) {
        const f = meta && meta.featured;
        return Number.isInteger(f) ? f : Infinity;
    }

    // True when candidate A should win a title-index collision over current B.
    function outranks(pathA, metaA, pathB, metaB) {
        const ra = rankOf(metaA);
        const rb = rankOf(metaB);
        if (ra !== rb) return ra < rb;
        return pathA < pathB;
    }

    function buildTitleIndex(metadata) {
        const index = new Map();
        for (const [path, meta] of Object.entries(metadata || {})) {
            if (!isListable(path, meta)) continue;
            const keys = new Set([stem(path).toLowerCase().trim()]);
            if (typeof meta.title === 'string' && meta.title.trim()) {
                keys.add(meta.title.toLowerCase().trim());
            }
            for (const key of keys) {
                if (!key) continue;
                const current = index.get(key);
                if (current === undefined || outranks(path, meta, current, metadata[current])) {
                    index.set(key, path);
                }
            }
        }
        return index;
    }

    function linkKey(target) {
        return String(target || '').split('|')[0].split('#')[0].replace(/\.md$/i, '').toLowerCase().trim();
    }

    function resolveWikilink(target, index) {
        if (!index) return null;
        const key = linkKey(target);
        if (!key) return null;
        if (index.has(key)) return index.get(key);
        // Links written with a folder path ([[01 Projects/Foo]]) resolve by their last segment.
        const last = segments(key).pop();
        if (last && index.has(last)) return index.get(last);
        return null;
    }

    function noteHref(path) {
        return '?note=' + encodeURIComponent(path);
    }

    function notePathFromSearch(search) {
        const raw = String(search || '');
        const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
        const note = params.get('note');
        return note ? note : null;
    }

    const WIKILINK_RE = /(!?)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;
    const CODE_SPLIT_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/;

    function rewriteSegment(text, index) {
        return text.replace(WIKILINK_RE, (match, bang, name, alias) => {
            const path = resolveWikilink(name, index);
            const display = (alias || name).trim();
            if (path) return `[${display}](${noteHref(path)})`;
            // An unresolved embed (image or private note) has nothing to show.
            return bang ? '' : display;
        });
    }

    function rewriteWikilinks(markdown, index) {
        const parts = String(markdown || '').split(CODE_SPLIT_RE);
        // Even indices are prose, odd indices are the captured code spans/fences.
        return parts.map((part, i) => (i % 2 === 0 ? rewriteSegment(part, index) : part)).join('');
    }

    function timeOf(value) {
        if (value === undefined || value === null || value === '') return 0;
        const t = Date.parse(String(value));
        return Number.isNaN(t) ? 0 : t;
    }

    function toEntry(path, meta) {
        const m = meta || {};
        return {
            path,
            title: (typeof m.title === 'string' && m.title.trim()) ? m.title.trim() : stem(path),
            summary: typeof m.summary === 'string' ? m.summary : '',
            blurb: typeof m.blurb === 'string' ? m.blurb : '',
            tags: tagsOf(m),
            featured: Number.isInteger(m.featured) ? m.featured : null,
            updated: m.updated ?? null,
            created: m.created ?? null,
            machine: typeof m.machine === 'string' ? m.machine : '',
        };
    }

    function byRankThenUpdated(metadata) {
        return (a, b) => {
            const ra = rankOf(metadata[a]);
            const rb = rankOf(metadata[b]);
            if (ra !== rb) return ra - rb;
            return timeOf((metadata[b] || {}).updated) - timeOf((metadata[a] || {}).updated);
        };
    }

    function relatedNotes(path, metadata, links, index, limit = 5) {
        const meta = metadata || {};
        const linkMap = links || {};
        const listable = (p) => p !== path && isListable(p, meta[p]);

        const outgoing = [];
        for (const target of linkMap[path] || []) {
            const resolved = resolveWikilink(target, index);
            if (resolved && listable(resolved) && !outgoing.includes(resolved)) outgoing.push(resolved);
            if (outgoing.length >= limit) break;
        }

        const incoming = Object.keys(linkMap)
            .filter(listable)
            .filter(p => (linkMap[p] || []).some(t => resolveWikilink(t, index) === path))
            .sort(byRankThenUpdated(meta))
            .slice(0, limit);

        return { outgoing, incoming };
    }

    // tag -> published paths carrying it, best ranked first.
    function tagIndex(metadata) {
        const meta = metadata || {};
        const idx = new Map();
        for (const path of Object.keys(meta)) {
            if (!isListable(path, meta[path])) continue;
            for (const tag of tagsOf(meta[path])) {
                if (!idx.has(tag)) idx.set(tag, []);
                idx.get(tag).push(path);
            }
        }
        const order = byRankThenUpdated(meta);
        for (const paths of idx.values()) paths.sort(order);
        return idx;
    }

    function tagHref(tag) {
        return '?tag=' + encodeURIComponent(normalizeTag(tag));
    }

    function tagFromSearch(search) {
        const raw = String(search || '');
        const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
        const tag = normalizeTag(params.get('tag'));
        return tag ? tag : null;
    }

    const machineOf = (meta) => (meta && (meta.machine === 'bigrig' || meta.machine === 'unraid')) ? 'bigrig' : 'mac';

    // Notes that share tags with this one. A shared rare tag says more than a shared common one,
    // and on a tie the note from the other machine wins, since that link is the one nobody wrote by hand.
    function sharedTagNotes(path, metadata, idx, limit = 5) {
        const meta = metadata || {};
        const scores = new Map();
        for (const tag of tagsOf(meta[path])) {
            const paths = (idx && idx.get(tag)) || [];
            const weight = 1 / Math.log2(1 + paths.length);
            for (const other of paths) {
                if (other === path) continue;
                scores.set(other, (scores.get(other) || 0) + weight);
            }
        }
        const own = machineOf(meta[path]);
        const order = byRankThenUpdated(meta);
        return [...scores.keys()].sort((a, b) =>
            (scores.get(b) - scores.get(a)) ||
            ((machineOf(meta[a]) === own) - (machineOf(meta[b]) === own)) ||
            order(a, b)
        ).slice(0, limit);
    }

    function filterNotes(query, entries) {
        const q = String(query || '').trim().toLowerCase();
        const list = entries || [];
        if (!q) return list;
        return list.filter(e => {
            const hay = [e.title, e.summary, ...(e.tags || [])].join('\n').toLowerCase();
            return hay.includes(q);
        });
    }

    function readingTime(text) {
        const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.ceil(words / 200));
    }

    const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

    // Some composed notes carry a stale second block right under the first; strip every leading block.
    function stripFrontmatter(markdown) {
        let text = String(markdown || '');
        for (;;) {
            const next = text.replace(FRONTMATTER_RE, '');
            if (next === text) return text;
            text = next;
        }
    }

    function plainText(paragraph) {
        return paragraph
            .replace(/!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (m, name, alias) => (alias || name).trim())
            .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/`([^`]*)`/g, '$1')
            .replace(/(\*\*|__)(.*?)\1/g, '$2')
            .replace(/(\*|_)(.*?)\1/g, '$2')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function truncateAtWord(text, max) {
        if (text.length <= max) return text;
        const cut = text.slice(0, max + 1);
        const lastSpace = cut.lastIndexOf(' ');
        const head = (lastSpace > 0 ? cut.slice(0, lastSpace) : text.slice(0, max)).replace(/[\s,;:.]+$/, '');
        return head + '…';
    }

    function snippetFromMarkdown(markdown, max = 160) {
        const body = stripFrontmatter(markdown)
            .replace(/```[\s\S]*?```/g, '')
            .replace(/~~~[\s\S]*?~~~/g, '');
        const paragraphs = body.split(/\r?\n\s*\r?\n/);
        for (const para of paragraphs) {
            const lines = para.split(/\r?\n/)
                .filter(line => !/^\s*#{1,6}\s/.test(line))
                .filter(line => !/^\s*!\[\[.*\]\]\s*$/.test(line))
                .map(line => line.replace(/^\s*(?:[-*+]|\d+[.)]|>)\s+/, ''));
            const text = plainText(lines.join(' '));
            if (text) return truncateAtWord(text, max);
        }
        return '';
    }

    function compareEntries(a, b) {
        const ra = a.featured ?? Infinity;
        const rb = b.featured ?? Infinity;
        if (ra !== rb) return ra - rb;
        const dt = timeOf(b.updated) - timeOf(a.updated);
        if (dt !== 0) return dt;
        return a.title.localeCompare(b.title);
    }

    function listableEntries(metadata) {
        const meta = metadata || {};
        return Object.keys(meta)
            .filter(p => isListable(p, meta[p]))
            .map(p => toEntry(p, meta[p]));
    }

    function groupByTopic(metadata) {
        const groups = new Map(TOPICS.map(t => [t.id, { ranked: [], unranked: [] }]));
        for (const entry of listableEntries(metadata)) {
            const topic = topicForPath(entry.path);
            if (!topic) continue;
            const bucket = groups.get(topic.id);
            (entry.featured === null ? bucket.unranked : bucket.ranked).push(entry);
        }
        for (const bucket of groups.values()) {
            bucket.ranked.sort(compareEntries);
            bucket.unranked.sort(compareEntries);
        }
        return groups;
    }

    function featuredStrip(metadata, limit = 10) {
        return listableEntries(metadata)
            .filter(e => e.featured !== null && e.featured >= 1 && e.featured <= limit)
            .sort(compareEntries);
    }

    function topicIndexOf(id) {
        return TOPICS.findIndex(t => t.id === id);
    }

    // Resolved, listable link targets of a note, one entry per link (duplicates count), self excluded.
    function linkTargets(path, metadata, links, index) {
        const out = [];
        for (const target of (links && links[path]) || []) {
            const resolved = resolveWikilink(target, index);
            if (resolved && resolved !== path && isListable(resolved, metadata[resolved])) out.push(resolved);
        }
        return out;
    }

    // Listable notes that link to this one, one entry per link.
    function linkSources(path, metadata, links, index) {
        const out = [];
        for (const source of Object.keys(links || {})) {
            if (source === path || !isListable(source, metadata[source])) continue;
            for (const target of links[source] || []) {
                if (resolveWikilink(target, index) === path) out.push(source);
            }
        }
        return out;
    }

    /**
     * Colour stops for a note's accent: its own topic first, holding at least half,
     * then up to two linked topics in proportion to how many links go there (both
     * directions). Shares sum to 1. Notes linked only inside their topic get one stop.
     */
    function accentStops(path, metadata, links, index) {
        const meta = metadata || {};
        const own = topicForPath(path);
        if (!own) return [{ id: null, share: 1 }];

        const counts = new Map();
        const neighbours = linkTargets(path, meta, links, index).concat(linkSources(path, meta, links, index));
        for (const p of neighbours) {
            const t = topicForPath(p);
            if (t) counts.set(t.id, (counts.get(t.id) || 0) + 1);
        }
        let total = neighbours.length;
        if (own.id !== 'benchmarks' && isBenchmarkTagged(meta[path])) {
            counts.set('benchmarks', (counts.get('benchmarks') || 0) + BENCHMARK_TAG_WEIGHT);
            total += BENCHMARK_TAG_WEIGHT;
        }

        const others = [...counts.entries()]
            .filter(([id]) => id !== own.id)
            .sort((a, b) => (b[1] - a[1]) || (topicIndexOf(a[0]) - topicIndexOf(b[0])))
            .slice(0, MAX_STOPS - 1);
        if (others.length === 0) return [{ id: own.id, share: 1 }];

        const ownShare = Math.max(OWN_SHARE_FLOOR, (counts.get(own.id) || 0) / total);
        const otherTotal = others.reduce((sum, [, n]) => sum + n, 0);
        const rest = 1 - ownShare;
        return [{ id: own.id, share: ownShare }]
            .concat(others.map(([id, n]) => ({ id, share: rest * (n / otherTotal) })));
    }

    // A solid colour for one stop, a hard-edged top-to-bottom gradient for several.
    function accentCss(stops) {
        const list = stops || [];
        if (list.length === 0) return FALLBACK_COLOR;
        if (list.length === 1) return topicColor(list[0].id);
        let at = 0;
        const parts = list.map((stop, i) => {
            const from = Math.round(at * 100);
            at = i === list.length - 1 ? 1 : at + stop.share;
            return `${topicColor(stop.id)} ${from}% ${Math.round(at * 100)}%`;
        });
        return `linear-gradient(180deg, ${parts.join(', ')})`;
    }

    function slug(text) {
        return String(text || '').toLowerCase().replace(/\.md$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    // '01 Projects/Penthouse/00 - Knowledge Hub.md' -> '~/projects/penthouse/00-knowledge-hub.md'
    function readerPath(path) {
        const segs = segments(path);
        const match = topicMatch(path) || topicMatchFolder(segs);
        if (!match) return '~';
        const topic = match.topic;
        const isFile = /\.md$/i.test(segs[segs.length - 1]);
        const rest = segs.slice(match.depth).map(slug).filter(Boolean);
        if (isFile && rest.length) rest[rest.length - 1] += '.md';
        return ['~', topic.id].concat(rest).join('/');
    }

    // readerPath also takes folder paths like '01 Projects/Penthouse', which topicMatch skips.
    function topicMatchFolder(segs) {
        return topicMatch(segs.concat('_.md'));
    }

    // The sub-folder directly under a note's topic folder, or '' for notes at the topic root.
    function folderKey(path) {
        const segs = segments(path);
        const match = topicMatch(path);
        const depth = match ? match.depth : 1;
        return segs.length >= depth + 2 ? segs[depth] : '';
    }

    function isStrip(entry) {
        return entry.featured !== null && entry.featured >= 1 && entry.featured <= STRIP_LIMIT;
    }

    // Ranked notes keep rank order; the rest chain through links from the last placed note,
    // and fall back to the newest unvisited note when the chain runs out.
    function orderByLinks(entries, metadata, links, index) {
        const ranked = entries.filter(e => e.featured !== null).sort(compareEntries);
        const pool = entries.filter(e => e.featured === null).sort(compareEntries);
        const ordered = ranked.slice();
        const inPool = new Set(pool.map(e => e.path));

        const degree = (a, b) =>
            linkTargets(a, metadata, links, index).filter(p => p === b).length +
            linkTargets(b, metadata, links, index).filter(p => p === a).length;

        while (pool.length) {
            const last = ordered[ordered.length - 1];
            let next = null;
            if (last) {
                let best = 0;
                for (const candidate of pool) {
                    const d = degree(last.path, candidate.path);
                    if (d > best) { best = d; next = candidate; }
                }
            }
            if (!next) next = pool[0];
            ordered.push(next);
            pool.splice(pool.indexOf(next), 1);
            inPool.delete(next.path);
        }
        return ordered;
    }

    /**
     * Groups a topic's entries by their sub-folder. Groups holding a strip note come
     * first (best rank wins), then larger groups, then alphabetical. Inside a group,
     * see orderByLinks. The root group is labelled './'.
     */
    function groupByFolder(entries, topicId, metadata, links, index) {
        const meta = metadata || {};
        const byKey = new Map();
        for (const entry of entries || []) {
            const key = folderKey(entry.path);
            if (!byKey.has(key)) byKey.set(key, []);
            byKey.get(key).push(entry);
        }
        const groups = [...byKey.entries()].map(([key, list]) => {
            const ranks = list.filter(isStrip).map(e => e.featured);
            return {
                key,
                label: key ? slug(key) + '/' : './',
                path: key ? `~/${topicId}/${slug(key)}` : `~/${topicId}`,
                bestRank: ranks.length ? Math.min(...ranks) : Infinity,
                entries: orderByLinks(list, meta, links, index),
            };
        });
        groups.sort((a, b) =>
            (a.bestRank - b.bestRank) ||
            (b.entries.length - a.entries.length) ||
            a.label.localeCompare(b.label));
        return groups.map(({ bestRank, ...g }) => g);
    }

    // Bars for the landing: notes per topic, largest first (ties keep topic order), share of the largest.
    function topicLoad(metadata) {
        const counts = new Map();
        for (const entry of listableEntries(metadata)) {
            const topic = topicForPath(entry.path);
            if (topic) counts.set(topic.id, (counts.get(topic.id) || 0) + 1);
        }
        const rows = TOPICS.filter(t => counts.has(t.id))
            .map(t => ({ id: t.id, label: t.label, count: counts.get(t.id) }))
            .sort((a, b) => (b.count - a.count) || (topicIndexOf(a.id) - topicIndexOf(b.id)));
        const max = rows.length ? rows[0].count : 1;
        return rows.map(r => ({ ...r, share: r.count / max }));
    }

    // Numbers for the about card: what is published, where it came from, and when.
    function gardenFacts(manifest) {
        const meta = (manifest && manifest.metadata) || {};
        const entries = listableEntries(meta);
        const topicIds = new Set();
        const machines = new Set();
        for (const e of entries) {
            const t = topicForPath(e.path);
            if (t) topicIds.add(t.id);
            if (e.machine) machines.add(e.machine);
        }
        return {
            notes: entries.length,
            topics: topicIds.size,
            machines: [...machines].sort(),
            featured: entries.filter(isStrip).length,
            generated: (manifest && manifest.generated_at) || null,
        };
    }

    // The boot animation plays once per session, never for reduced motion.
    function shouldBoot(storage, reducedMotion) {
        if (reducedMotion) return false;
        try {
            return !(storage && typeof storage.getItem === 'function' && storage.getItem('garden-booted'));
        } catch (e) {
            return true;
        }
    }

    const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    // Safe for text nodes and for double- or single-quoted attribute values.
    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
    }

    const MODES = ['reader', 'terminal'];

    // Mode persisted in localStorage; anything missing, unknown, or unreadable means reader.
    function readStoredMode(storage) {
        try {
            const value = storage && typeof storage.getItem === 'function' ? storage.getItem('garden-mode') : null;
            return MODES.includes(value) ? value : 'reader';
        } catch (e) {
            return 'reader';
        }
    }

    // True when a keystroke on this element is the user typing, not a shortcut.
    function isTypingTarget(el) {
        if (!el) return false;
        const tag = String(el.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        return el.isContentEditable === true;
    }

    const GardenReaderLogic = {
        TOPICS,
        HIDDEN_SEGMENTS,
        HIDDEN_ROOT_FILES,
        isHiddenPath,
        isListable,
        topicForPath,
        isBenchmarkTagged,
        normalizeTag,
        tagsOf,
        tagIndex,
        tagHref,
        tagFromSearch,
        sharedTagNotes,
        machineOf,
        topicLoad,
        buildTitleIndex,
        resolveWikilink,
        rewriteWikilinks,
        noteHref,
        notePathFromSearch,
        toEntry,
        relatedNotes,
        filterNotes,
        readingTime,
        snippetFromMarkdown,
        stripFrontmatter,
        groupByTopic,
        featuredStrip,
        topicColor,
        accentStops,
        accentCss,
        groupByFolder,
        readerPath,
        gardenFacts,
        shouldBoot,
        readStoredMode,
        isTypingTarget,
        escapeHtml,
    };

    if (typeof module !== 'undefined') module.exports = GardenReaderLogic;
    if (typeof window !== 'undefined') window.GardenReaderLogic = GardenReaderLogic;
})();
