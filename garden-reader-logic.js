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

    const TOPICS = [
        { id: 'projects', label: 'Projects', description: 'Things I built end to end', folders: ['01 Projects'] },
        { id: 'homelab', label: 'Homelab', description: 'The physical servers, network, and the builds and upgrades behind them', folders: ['02 Homelab'] },
        { id: 'ai', label: 'AI and benchmarks', description: 'Running models on my own hardware, with the numbers', folders: ['03 AI and Local Models'] },
        { id: 'linux', label: 'Linux and systems', description: 'Notes from the command line and the code', folders: ['05 Linux and Systems', '04 Programming'] },
        { id: 'journals', label: 'Learning journals', description: 'What I was figuring out, as I figured it out', folders: ['06 Learning Journals'] },
        { id: 'tools', label: 'Tools and workflow', description: 'How the notes, the sync, and the publishing work', folders: ['07 Tools and Workflow'] },
    ];

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

    function topicForPath(path) {
        const segs = segments(path);
        if (segs.length < 2 || isHiddenPath(path)) return null;
        return TOPICS.find(t => t.folders.includes(segs[0])) || null;
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
            tags: Array.isArray(m.tags) ? m.tags.map(String) : [],
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

    function stripFrontmatter(markdown) {
        return String(markdown || '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
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
        groupByTopic,
        featuredStrip,
        readStoredMode,
        isTypingTarget,
        escapeHtml,
    };

    if (typeof module !== 'undefined') module.exports = GardenReaderLogic;
    if (typeof window !== 'undefined') window.GardenReaderLogic = GardenReaderLogic;
})();
