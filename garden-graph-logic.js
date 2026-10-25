/**
 * Knowledge Garden graph logic: which notes and edges the graph shows, the
 * local graph around one note, and the sizing and label rules the canvas
 * draws with. Pure functions, loaded as a plain script (window.GardenGraphLogic)
 * and by the node:test suite. Edges follow the reader's own link resolution,
 * so the graph agrees with a note's links-in and links-out lists.
 */
(function () {
    const L = typeof module !== 'undefined' && typeof require === 'function'
        ? require('./garden-reader-logic.js')
        : window.GardenReaderLogic;

    const TAG_PREFIX = 'tag:';

    function edgeKey(a, b) {
        return a < b ? `${a}\n${b}` : `${b}\n${a}`;
    }

    /**
     * Nodes are the published notes the reader lists. Wikilinks become one
     * undirected edge per pair; links to a note's own sections are not edges.
     * With `tags`, each tag on two or more notes becomes a node joined to them.
     * Without `orphans`, nodes with no edge are left out.
     */
    function buildGraph(manifest, { tags = false, orphans = true } = {}) {
        const metadata = (manifest && manifest.metadata) || {};
        const links = (manifest && manifest.links) || {};
        const index = L.buildTitleIndex(metadata);

        const nodes = [];
        const byId = new Map();
        for (const [path, meta] of Object.entries(metadata)) {
            if (!L.isListable(path, meta)) continue;
            const topic = L.topicForPath(path);
            const node = {
                id: path,
                kind: 'note',
                title: L.toEntry(path, meta).title,
                topic: topic ? topic.id : null,
                machine: L.machineOf(meta),
                tags: L.tagsOf(meta),
                degree: 0,
            };
            nodes.push(node);
            byId.set(path, node);
        }

        const out = [];
        const seen = new Set();
        const add = (source, target, kind) => {
            const key = edgeKey(source, target);
            if (seen.has(key)) return;
            seen.add(key);
            out.push({ source, target, kind });
        };

        for (const [source, targets] of Object.entries(links)) {
            if (!byId.has(source)) continue;
            for (const target of targets || []) {
                const resolved = L.resolveWikilink(target, index);
                if (resolved && resolved !== source && byId.has(resolved)) add(source, resolved, 'link');
            }
        }

        if (tags) {
            for (const [tag, paths] of L.tagIndex(metadata)) {
                const members = paths.filter(p => byId.has(p));
                if (members.length < 2) continue;
                const id = TAG_PREFIX + tag;
                const node = { id, kind: 'tag', title: `#${tag}`, topic: null, machine: null, tags: [tag], degree: 0 };
                nodes.push(node);
                byId.set(id, node);
                for (const p of members) add(id, p, 'tag');
            }
        }

        const nb = neighbourMap(out);
        for (const node of nodes) node.degree = nb.has(node.id) ? nb.get(node.id).size : 0;

        const kept = orphans ? nodes : nodes.filter(n => n.degree > 0);
        return { nodes: kept, links: out };
    }

    function neighbourMap(links) {
        const map = new Map();
        const link = (a, b) => {
            if (!map.has(a)) map.set(a, new Set());
            map.get(a).add(b);
        };
        for (const l of links) {
            const s = typeof l.source === 'object' ? l.source.id : l.source;
            const t = typeof l.target === 'object' ? l.target.id : l.target;
            link(s, t);
            link(t, s);
        }
        return map;
    }

    /** The note, every note within `depth` steps of it, and the edges among them. Empty when the note has no edges. */
    function localGraph(graph, id, { depth = 1 } = {}) {
        const nb = neighbourMap(graph.links);
        if (!nb.has(id)) return { nodes: [], links: [], center: id };
        const keep = new Set([id]);
        let frontier = [id];
        for (let step = 0; step < depth; step++) {
            const next = [];
            for (const at of frontier) {
                for (const other of nb.get(at) || []) {
                    if (!keep.has(other)) { keep.add(other); next.push(other); }
                }
            }
            frontier = next;
        }
        const nodes = graph.nodes.filter(n => keep.has(n.id)).map(n => ({ ...n }));
        const links = graph.links
            .map(l => ({
                source: typeof l.source === 'object' ? l.source.id : l.source,
                target: typeof l.target === 'object' ? l.target.id : l.target,
                kind: l.kind,
            }))
            .filter(l => keep.has(l.source) && keep.has(l.target));
        return { nodes, links, center: id };
    }

    /** Dot radius in graph units: hubs are bigger, tags a little smaller than notes. */
    function nodeRadius(node) {
        const d = Math.max(0, node.degree || 0);
        return node.kind === 'tag'
            ? Math.min(10, 2 + Math.sqrt(d) * 1.2)
            : Math.min(16, 3 + Math.sqrt(d) * 1.8);
    }

    /** Label opacity from the dot's size on screen: hubs are labelled at rest, the rest fade in as you zoom. */
    function labelAlpha(zoom, radius) {
        const onScreen = zoom * radius;
        return Math.max(0, Math.min(1, (onScreen - 7.5) / 4));
    }

    /** Ids of nodes whose title or tags contain the query. */
    function searchGraph(graph, query) {
        const q = String(query || '').trim().toLowerCase();
        const hits = new Set();
        if (!q) return hits;
        for (const n of graph.nodes) {
            if (n.title.toLowerCase().includes(q) || (n.tags || []).some(t => t.includes(q))) hits.add(n.id);
        }
        return hits;
    }

    const GardenGraphLogic = { TAG_PREFIX, buildGraph, neighbourMap, localGraph, nodeRadius, labelAlpha, searchGraph };

    if (typeof module !== 'undefined') module.exports = GardenGraphLogic;
    if (typeof window !== 'undefined') window.GardenGraphLogic = GardenGraphLogic;
})();
