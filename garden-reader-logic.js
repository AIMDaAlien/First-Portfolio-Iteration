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
    };

    if (typeof module !== 'undefined') module.exports = GardenReaderLogic;
    if (typeof window !== 'undefined') window.GardenReaderLogic = GardenReaderLogic;
})();
