/**
 * Knowledge Garden graph view, drawn on a canvas the way Obsidian draws its
 * graph: small dots in topic colours, faint links, labels that fade in as you
 * zoom, and hover to light a note and its neighbours.
 *
 * GraphCanvas draws one graph. The overlay (KnowledgeGardenGraph) adds search,
 * filters and the legend; the reader mounts a small local graph under each
 * note. Which notes and edges appear is decided in garden-graph-logic.js.
 */
(function () {
    const GL = window.GardenGraphLogic;
    const RL = window.GardenReaderLogic;

    const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    /** Canvas cannot read CSS variables, so resolve 'var(--x)' to its value. */
    function cssColor(value, fallback = '#BBC3FF') {
        const m = /^var\((--[^),\s]+)/.exec(String(value || ''));
        if (!m) return value || fallback;
        return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || fallback;
    }

    const idOf = (end) => (typeof end === 'object' ? end.id : end);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const shorten = (text, max) => (text.length > max ? text.slice(0, max - 1) + '…' : text);

    class GraphCanvas {
        /**
         * mode 'full' pans and zooms; mode 'local' sits inside the scrolling note,
         * so it never takes the wheel or a touch drag and only fits itself to its box.
         */
        constructor(host, { mode = 'full', onOpen = () => { }, onSelect = () => { }, colorBy = 'topic' } = {}) {
            this.host = host;
            this.mode = mode;
            this.onOpen = onOpen;
            this.onSelect = onSelect;
            this.colorBy = colorBy;

            this.canvas = document.createElement('canvas');
            this.canvas.className = 'graph-surface';
            this.canvas.setAttribute('aria-hidden', 'true');
            host.appendChild(this.canvas);
            this.ctx = this.canvas.getContext('2d');

            this.transform = d3.zoomIdentity;
            this.width = 0;
            this.height = 0;
            this.dpr = 1;
            this.nodes = [];
            this.links = [];
            this.byId = new Map();
            this.nb = new Map();
            this.centerId = null;
            this.hoverId = null;
            this.selectedId = null;
            this.lastFocus = null;
            this.matches = null;          // Set of ids lit by a search, or null
            this.hidden = new Set();      // legend groups switched off
            this.fade = 0;                // 0: nothing lit, 1: everything outside the lit set dimmed
            this.frame = 0;
            this.fitted = false;
            this.paused = false;
            this.destroyed = false;

            const local = mode === 'local';
            this.sim = d3.forceSimulation()
                .force('link', d3.forceLink().id(d => d.id)
                    .distance(l => (local ? 80 : l.kind === 'tag' ? 46 : 30))
                    .strength(l => {
                        const a = this.nb.get(idOf(l.source))?.size || 1;
                        const b = this.nb.get(idOf(l.target))?.size || 1;
                        return (l.kind === 'tag' ? 0.25 : 1) / Math.min(a, b);
                    }))
                .force('charge', d3.forceManyBody().strength(local ? -320 : -48).distanceMax(local ? 500 : 360).theta(0.9))
                .force('x', d3.forceX(0))
                .force('y', d3.forceY(0))
                .force('collide', d3.forceCollide(d => d.r + 2))
                .alphaDecay(0.035)
                .on('tick', () => this.requestDraw())
                .stop();

            this.readColors();
            this.bindPointer();
            if (!local) this.bindZoom();
            this.ro = new ResizeObserver(() => this.resize());
            this.ro.observe(host);
            this.resize();
            document.fonts?.ready?.then(() => this.requestDraw());
        }

        readColors() {
            const topics = {};
            for (const t of RL.TOPICS) topics[t.id] = cssColor(RL.topicColor(t.id));
            this.colors = {
                topics,
                other: cssColor('var(--md-sys-color-primary)'),
                mac: cssColor('var(--md-sys-color-primary)'),
                bigrig: cssColor('var(--md-sys-color-tertiary)', '#E8B9D5'),
                tag: cssColor('var(--md-sys-color-outline)', '#908F9A'),
                link: cssColor('var(--md-sys-color-outline)', '#908F9A'),
                lit: cssColor('var(--md-sys-color-primary)'),
                text: cssColor('var(--md-sys-color-on-surface-variant)', '#C6C5D0'),
                strong: cssColor('var(--md-sys-color-on-surface)', '#E4E1E9'),
                halo: cssColor('var(--md-sys-color-surface-container-lowest)', '#0D0E13'),
            };
            this.requestDraw();
        }

        groupOf(n) {
            if (n.kind === 'tag') return 'tag';
            return this.colorBy === 'machine' ? n.machine : (n.topic || 'other');
        }

        colorOf(n) {
            if (n.kind === 'tag') return this.colors.tag;
            if (this.colorBy === 'machine') return this.colors[n.machine] || this.colors.mac;
            return this.colors.topics[n.topic] || this.colors.other;
        }

        isShown(n) {
            return !this.hidden.has(this.groupOf(n));
        }

        // ---------------- data ----------------

        setData(graph, { center = null } = {}) {
            const old = this.byId;
            let fresh = 0;
            this.nodes = graph.nodes.map(n => {
                const prev = old.get(n.id);
                if (prev) return Object.assign(prev, n);
                fresh++;
                return { ...n };
            });
            this.byId = new Map(this.nodes.map(n => [n.id, n]));
            this.links = graph.links.map(l => ({ source: idOf(l.source), target: idOf(l.target), kind: l.kind }));
            this.nb = GL.neighbourMap(this.links);
            this.centerId = center;
            for (const n of this.nodes) n.r = GL.nodeRadius(n) * (n.id === center ? 1.4 : 1);

            // A new note joins next to a neighbour that already has a place, so toggles do not scatter the layout.
            for (const n of this.nodes) {
                if (n.x !== undefined) continue;
                const anchor = [...(this.nb.get(n.id) || [])].map(id => this.byId.get(id)).find(m => m && m.x !== undefined);
                if (anchor) { n.x = anchor.x + (Math.random() - 0.5) * 20; n.y = anchor.y + (Math.random() - 0.5) * 20; }
                else if (n.id === center) { n.x = 0; n.y = 0; }
            }
            if (this.selectedId && !this.byId.has(this.selectedId)) this.select(null);
            if (this.hoverId && !this.byId.has(this.hoverId)) this.hoverId = null;

            this.sim.nodes(this.nodes);
            this.sim.force('link').links(this.links);
            this.shapeToBox();

            // Settle most of the layout before the first frame, so it opens calm instead of exploding outward.
            const warm = fresh === this.nodes.length ? (this.mode === 'local' ? 180 : 220) : 60;
            this.sim.alpha(1);
            for (let i = 0; i < warm; i++) this.sim.tick();
            this.fitted = false;
            this.fit(false);
            if (this.mode === 'full' && !reducedMotion() && !this.paused) this.sim.alpha(0.12).restart();
            this.requestDraw();
        }

        /** Pull harder across the short side of the box, so a tall phone gets a tall graph. */
        shapeToBox() {
            const base = this.mode === 'local' ? 0.09 : 0.045;
            const aspect = this.width && this.height ? this.height / this.width : 1;
            const lean = clamp(Math.sqrt(aspect), 0.6, 1.8);
            this.sim.force('x').strength(base * lean);
            this.sim.force('y').strength(base / lean);
        }

        setColorBy(mode) {
            this.colorBy = mode;
            this.hidden.clear();
            this.requestDraw();
        }

        setHidden(groups) {
            this.hidden = new Set(groups);
            if (this.selectedId && !this.isShown(this.byId.get(this.selectedId))) this.select(null);
            this.requestDraw();
        }

        setMatches(ids) {
            this.matches = ids;
            this.requestDraw();
        }

        select(id) {
            this.selectedId = id;
            this.onSelect(id ? this.byId.get(id) : null);
            this.requestDraw();
        }

        /** Light a note and frame it with its neighbours. */
        focusOn(id) {
            const n = this.byId.get(id);
            if (!n || !this.width) return;
            const near = [...this.litSet(id)].map(x => this.byId.get(x)).filter(m => m && this.isShown(m));
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (const m of near) {
                x0 = Math.min(x0, m.x); x1 = Math.max(x1, m.x);
                y0 = Math.min(y0, m.y); y1 = Math.max(y1, m.y);
            }
            // A big neighbourhood stays zoomed out enough that only its own hubs are named.
            const k = clamp(Math.min((this.width - 160) / Math.max(1, x1 - x0), (this.height - 120) / Math.max(1, y1 - y0)), 0.3, near.length > 30 ? 1.1 : 1.8);
            const t = d3.zoomIdentity.translate(this.width / 2 - k * (x0 + x1) / 2, this.height / 2 - k * (y0 + y1) / 2).scale(k);
            this.setTransform(t, true);
            this.select(id);
        }

        reheat() {
            if (!reducedMotion()) this.sim.alpha(0.5).restart();
        }

        pause() {
            this.paused = true;
            this.sim.stop();
        }

        resume() {
            this.paused = false;
            this.resize();
            this.requestDraw();
        }

        destroy() {
            if (this.destroyed) return;
            this.destroyed = true;
            this.sim.stop();
            cancelAnimationFrame(this.frame);
            this.ro.disconnect();
            this.canvas.remove();
        }

        // ---------------- view ----------------

        resize() {
            if (this.destroyed) return;
            if (!this.canvas.isConnected) { this.destroy(); return; }
            const rect = this.host.getBoundingClientRect();
            const w = Math.round(rect.width);
            const h = Math.round(rect.height);
            if (!w || !h) return;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            if (w === this.width && h === this.height && dpr === this.dpr) return;
            this.width = w;
            this.height = h;
            this.dpr = dpr;
            this.canvas.width = Math.round(w * dpr);
            this.canvas.height = Math.round(h * dpr);
            if (!this.fitted || this.mode === 'local') this.fit(false);
            this.requestDraw();
        }

        fit(animate = true) {
            if (!this.width || !this.height) return;
            const shown = this.nodes.filter(n => this.isShown(n) && Number.isFinite(n.x));
            if (!shown.length) return;
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (const n of shown) {
                x0 = Math.min(x0, n.x - n.r); x1 = Math.max(x1, n.x + n.r);
                y0 = Math.min(y0, n.y - n.r); y1 = Math.max(y1, n.y + n.r);
            }
            const local = this.mode === 'local';
            // Room for labels under the dots, more of it in the small local box.
            const padX = local ? 70 : 40;
            const padY = local ? 34 : 40;
            const k = clamp(Math.min((this.width - padX * 2) / Math.max(1, x1 - x0), (this.height - padY * 2) / Math.max(1, y1 - y0)),
                0.08, local ? 1.7 : 1.4);
            const t = d3.zoomIdentity
                .translate(this.width / 2 - k * (x0 + x1) / 2, this.height / 2 - k * (y0 + y1) / 2)
                .scale(k);
            this.fitted = true;
            this.setTransform(t, animate);
        }

        setTransform(t, animate) {
            if (this.zoom) {
                const sel = d3.select(this.canvas);
                if (animate && !reducedMotion()) sel.transition().duration(450).call(this.zoom.transform, t);
                else sel.call(this.zoom.transform, t);
            } else {
                this.transform = t;
                this.requestDraw();
            }
        }

        // ---------------- input ----------------

        point(e) {
            const rect = this.canvas.getBoundingClientRect();
            return [e.clientX - rect.left, e.clientY - rect.top];
        }

        nodeAt(sx, sy, slop) {
            const [wx, wy] = this.transform.invert([sx, sy]);
            const reach = slop / this.transform.k;
            let best = null;
            let bestD = Infinity;
            for (const n of this.nodes) {
                if (!this.isShown(n)) continue;
                const d = Math.hypot(n.x - wx, n.y - wy);
                if (d <= n.r + reach && d < bestD) { best = n; bestD = d; }
            }
            return best;
        }

        bindZoom() {
            this.zoom = d3.zoom()
                .scaleExtent([0.06, 8])
                .filter(e => {
                    if (e.type === 'wheel') return true;
                    if (e.button) return false;
                    if (e.touches && e.touches.length > 1) return true;
                    const p = e.touches ? e.touches[0] : e;
                    // A press on a dot drags the dot; anywhere else pans.
                    return !this.nodeAt(...this.point(p), e.touches ? 12 : 4);
                })
                .on('zoom', e => { this.transform = e.transform; this.requestDraw(); });
            d3.select(this.canvas).call(this.zoom).on('dblclick.zoom', null);
        }

        bindPointer() {
            const c = this.canvas;
            c.addEventListener('pointermove', e => {
                if (this.drag && e.pointerId === this.drag.pointer) { this.dragMove(e); return; }
                if (e.pointerType !== 'mouse' || this.down) return;
                const n = this.nodeAt(...this.point(e), 4);
                this.setHover(n ? n.id : null);
                c.style.cursor = n ? 'pointer' : (this.zoom ? 'grab' : 'default');
            });
            c.addEventListener('pointerleave', () => { if (!this.drag) this.setHover(null); });
            c.addEventListener('pointerdown', e => {
                if (e.button) return;
                const n = this.nodeAt(...this.point(e), e.pointerType === 'mouse' ? 4 : 12);
                this.down = { x: e.clientX, y: e.clientY, id: n ? n.id : null, type: e.pointerType, moved: false };
                // Touch on the local graph is left to the page, so a swipe over it still scrolls the note.
                if (n && (this.mode === 'full' || e.pointerType === 'mouse')) {
                    this.drag = { node: n, pointer: e.pointerId };
                    c.setPointerCapture?.(e.pointerId);
                }
            });
            c.addEventListener('pointerup', e => this.release(e));
            c.addEventListener('pointercancel', () => { this.endDrag(); this.down = null; });
        }

        setHover(id) {
            if (id === this.hoverId) return;
            this.hoverId = id;
            this.requestDraw();
        }

        dragMove(e) {
            const d = this.down;
            if (!d) return;
            if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
            if (!d.moved) {
                d.moved = true;
                this.sim.alphaTarget(0.25).restart();
            }
            const [wx, wy] = this.transform.invert(this.point(e));
            this.drag.node.fx = wx;
            this.drag.node.fy = wy;
        }

        endDrag() {
            if (!this.drag) return;
            const n = this.drag.node;
            n.fx = null;
            n.fy = null;
            this.drag = null;
            this.sim.alphaTarget(0);
            if (this.mode === 'local') this.sim.on('end.refit', () => { this.sim.on('end.refit', null); this.fit(false); });
        }

        release(e) {
            const d = this.down;
            this.down = null;
            const dragged = d && d.moved;
            this.endDrag();
            if (!d || dragged || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 6) return;
            if (d.id === null) { this.select(null); return; }
            const n = this.byId.get(d.id);
            // A mouse click opens; a first tap shows the card, since touch has no hover. The local graph opens on tap.
            if (d.type === 'mouse' || this.mode === 'local' || this.selectedId === d.id) this.onOpen(n);
            else this.select(d.id);
        }

        // ---------------- drawing ----------------

        requestDraw() {
            if (this.frame || this.destroyed) return;
            this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); });
        }

        litSet(id) {
            const set = new Set([id]);
            for (const other of this.nb.get(id) || []) set.add(other);
            return set;
        }

        draw() {
            if (!this.canvas.isConnected) { this.destroy(); return; }
            const { ctx, dpr, width: w, height: h } = this;
            if (!w || !h) return;

            const focus = this.hoverId ?? (this.drag && this.down?.moved ? this.drag.node.id : null) ?? this.selectedId;
            if (focus) this.lastFocus = focus;
            const target = focus ? 1 : 0;
            this.fade = reducedMotion() ? target : this.fade + (target - this.fade) * 0.25;
            if (Math.abs(target - this.fade) < 0.02) this.fade = target;
            const lit = this.fade > 0 && this.lastFocus ? this.litSet(this.lastFocus) : null;
            const litCenter = lit ? this.lastFocus : null;
            const m = this.matches;
            const t = this.transform;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.setTransform(dpr * t.k, 0, 0, dpr * t.k, dpr * t.x, dpr * t.y);

            // Links: one stroke per style, so a thousand of them stay cheap.
            const dim = 1 - 0.85 * this.fade;
            const quiet = m ? 0.3 : 1;
            ctx.lineWidth = 1 / t.k;
            ctx.strokeStyle = this.colors.link;
            for (const kind of ['tag', 'link']) {
                ctx.beginPath();
                for (const l of this.links) {
                    if (l.kind !== kind) continue;
                    const s = l.source, g = l.target;
                    if (!this.isShown(s) || !this.isShown(g)) continue;
                    if (litCenter && (s.id === litCenter || g.id === litCenter)) continue;
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(g.x, g.y);
                }
                ctx.globalAlpha = (kind === 'tag' ? 0.14 : 0.32) * dim * quiet;
                ctx.stroke();
            }
            if (litCenter) {
                ctx.beginPath();
                for (const l of this.links) {
                    const s = l.source, g = l.target;
                    if (s.id !== litCenter && g.id !== litCenter) continue;
                    if (!this.isShown(s) || !this.isShown(g)) continue;
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(g.x, g.y);
                }
                ctx.strokeStyle = this.colors.lit;
                ctx.lineWidth = 1.4 / t.k;
                ctx.globalAlpha = 0.25 + 0.65 * this.fade;
                ctx.stroke();
            }

            // Dots, lit ones last so they sit on top.
            const order = lit ? [...this.nodes].sort((a, b) => lit.has(a.id) - lit.has(b.id)) : this.nodes;
            for (const n of order) {
                if (!this.isShown(n)) continue;
                let a = n.kind === 'tag' ? 0.8 : 1;
                if (lit && !lit.has(n.id)) a *= 1 - 0.82 * this.fade;
                if (m && !m.has(n.id)) a *= 0.15;
                ctx.globalAlpha = a;
                ctx.fillStyle = this.colorOf(n);
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fill();
                const ring = n.id === this.centerId || n.id === this.selectedId || (m && m.has(n.id));
                if (ring) {
                    ctx.globalAlpha = Math.max(a, 0.6);
                    ctx.strokeStyle = this.colors.lit;
                    ctx.lineWidth = 1.5 / t.k;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, n.r + 3 / t.k, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            // Labels, in screen space so they stay one size while the dots scale.
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = this.colors.halo;
            const labelAll = this.mode === 'local' && this.nodes.length <= 24;
            const labels = [];
            for (const n of this.nodes) {
                if (!this.isShown(n)) continue;
                let a = labelAll ? 1 : GL.labelAlpha(t.k, n.r);
                if (lit) a = lit.has(n.id) ? Math.max(a, lit.size <= 30 ? this.fade : 0) : a * (1 - 0.9 * this.fade);
                if (m) a = m.has(n.id) ? 1 : a * 0.2;
                const own = n.id === this.centerId || n.id === this.selectedId || (lit && n.id === litCenter);
                if (own) a = 1;
                if (a < 0.03) continue;
                const sx = t.applyX(n.x);
                const sy = t.applyY(n.y) + n.r * t.k + 4;
                if (sx < -150 || sx > w + 150 || sy < -20 || sy > h + 20) continue;
                labels.push({ n, a, sx, sy, layer: own ? 2 : (lit && lit.has(n.id)) || (m && m.has(n.id)) ? 1 : 0 });
            }
            labels.sort((p, q) => p.layer - q.layer);
            for (const { n, a, sx, sy, layer } of labels) {
                const big = layer === 2;
                ctx.font = big ? '600 13px Ubuntu, sans-serif' : '500 11px Ubuntu, sans-serif';
                ctx.lineWidth = big ? 4 : 3;
                ctx.fillStyle = big ? this.colors.strong : this.colors.text;
                const text = shorten(n.title, big ? 48 : this.mode === 'local' ? 30 : 34);
                ctx.globalAlpha = a;
                ctx.strokeText(text, sx, sy);
                ctx.fillText(text, sx, sy);
            }
            ctx.globalAlpha = 1;

            if (this.fade !== target) this.requestDraw();
        }
    }

    /** The full-screen graph: search, filters, legend, and the tap card on phones. */
    class KnowledgeGardenGraph {
        constructor() {
            this.options = { tags: false, orphans: true };
            this.colorBy = 'topic';
            this.hidden = new Set();
            this.query = '';
            this.view = null;
            this.graph = null;
            this.manifest = null;
            this.isVisible = false;
        }

        async init(containerId) {
            this.container = document.getElementById(containerId);
            if (!this.container) return;
            this.container.innerHTML = '<p class="graph-loading">reading the vault…</p>';
            let manifest = window.garden?.manifest || null;
            if (!manifest) {
                try { manifest = await window.garden?.fetchManifest?.(); } catch (error) { manifest = null; }
            }
            if (!manifest || !GL) {
                this.container.innerHTML = '<p class="graph-loading">could not read the vault. close this and try again in a bit.</p>';
                return;
            }

            const narrow = window.innerWidth < 720;
            const touch = window.matchMedia?.('(pointer: coarse)').matches;
            this.container.innerHTML = `
                <div class="graph-stage"></div>
                <aside class="graph-panel${narrow ? ' is-collapsed' : ''}">
                    <button type="button" class="graph-panel-toggle" aria-expanded="${!narrow}" aria-controls="graphPanelBody">
                        <span aria-hidden="true">☰</span> filters
                    </button>
                    <div class="graph-panel-body" id="graphPanelBody">
                        <input type="search" class="graph-search" placeholder="find a note" aria-label="find a note in the graph" autocomplete="off">
                        <p class="graph-search-count" aria-live="polite"></p>
                        <label class="graph-switch"><input type="checkbox" data-opt="tags"><span>tags as dots</span></label>
                        <label class="graph-switch"><input type="checkbox" data-opt="orphans" checked><span>unlinked notes</span></label>
                        <div class="graph-segment" role="radiogroup" aria-label="colour by">
                            <button type="button" role="radio" data-color="topic" aria-checked="true">topic</button>
                            <button type="button" role="radio" data-color="machine" aria-checked="false">machine</button>
                        </div>
                        <div class="graph-legend" role="group" aria-label="show or hide a group"></div>
                        <p class="graph-stats"></p>
                    </div>
                </aside>
                <p class="graph-hint">${touch ? 'pinch to zoom · tap a dot to see it, tap again to open' : 'scroll to zoom · drag to pan · hover to trace · click to open'}</p>
                <div class="graph-card" hidden>
                    <span class="graph-card-dot" aria-hidden="true"></span>
                    <span class="graph-card-text"><strong class="graph-card-title"></strong><span class="graph-card-meta"></span></span>
                    <button type="button" class="graph-card-open">open</button>
                </div>`;

            this.view = new GraphCanvas(this.container.querySelector('.graph-stage'), {
                mode: 'full',
                onOpen: n => this.open(n),
                onSelect: n => this.showCard(n),
            });
            this.bindControls();
            this.load(manifest);
        }

        load(manifest) {
            this.manifest = manifest;
            this.rebuild();
        }

        rebuild() {
            this.graph = GL.buildGraph(this.manifest, this.options);
            this.view.setData(this.graph);
            this.renderLegend();
            this.applySearch(this.query);
        }

        bindControls() {
            const c = this.container;
            const panel = c.querySelector('.graph-panel');
            c.querySelector('.graph-panel-toggle').addEventListener('click', (e) => {
                const open = panel.classList.toggle('is-collapsed') === false;
                e.currentTarget.setAttribute('aria-expanded', String(open));
            });
            const search = c.querySelector('.graph-search');
            search.addEventListener('input', () => this.applySearch(search.value));
            search.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const best = this.bestMatch();
                if (best) this.view.focusOn(best.id);
            });
            c.querySelectorAll('[data-opt]').forEach(box => box.addEventListener('change', () => {
                this.options[box.dataset.opt] = box.checked;
                this.rebuild();
            }));
            c.querySelectorAll('[data-color]').forEach(btn => btn.addEventListener('click', () => {
                this.colorBy = btn.dataset.color;
                c.querySelectorAll('[data-color]').forEach(b => b.setAttribute('aria-checked', String(b === btn)));
                this.hidden.clear();
                this.view.setColorBy(this.colorBy);
                this.renderLegend();
            }));
            c.querySelector('.graph-legend').addEventListener('click', (e) => {
                const btn = e.target.closest('[data-group]');
                if (!btn) return;
                const g = btn.dataset.group;
                if (this.hidden.has(g)) this.hidden.delete(g); else this.hidden.add(g);
                this.view.setHidden(this.hidden);
                this.renderLegend();
            });
            c.querySelector('.graph-card-open').addEventListener('click', () => {
                const n = this.view.byId.get(this.view.selectedId);
                if (n) this.open(n);
            });
        }

        groups() {
            const counts = new Map();
            for (const n of this.graph.nodes) {
                const g = this.view.groupOf(n);
                counts.set(g, (counts.get(g) || 0) + 1);
            }
            const rows = this.colorBy === 'machine'
                ? [{ id: 'mac', label: 'mac', color: this.view.colors.mac }, { id: 'bigrig', label: 'bigrig', color: this.view.colors.bigrig }]
                : RL.TOPICS.map(t => ({ id: t.id, label: t.label.toLowerCase(), color: this.view.colors.topics[t.id] }));
            if (counts.has('tag')) rows.push({ id: 'tag', label: 'tags', color: this.view.colors.tag });
            return rows.filter(r => counts.has(r.id)).map(r => ({ ...r, count: counts.get(r.id) }));
        }

        renderLegend() {
            const esc = RL.escapeHtml;
            this.container.querySelector('.graph-legend').innerHTML = this.groups().map(g =>
                `<button type="button" class="graph-legend-item" data-group="${esc(g.id)}" aria-pressed="${!this.hidden.has(g.id)}">
                    <span class="graph-legend-dot" style="background:${esc(g.color)}" aria-hidden="true"></span>
                    <span class="graph-legend-label">${esc(g.label)}</span><span class="graph-legend-count">${g.count}</span>
                </button>`).join('');
            const notes = this.graph.nodes.filter(n => n.kind === 'note').length;
            const links = this.graph.links.filter(l => l.kind === 'link').length;
            const tags = this.graph.nodes.length - notes;
            this.container.querySelector('.graph-stats').textContent =
                `${notes} notes · ${links} links${tags ? ` · ${tags} tags` : ''}`;
        }

        applySearch(value) {
            const had = this.query.trim();
            this.query = value || '';
            const hits = this.query.trim() ? GL.searchGraph(this.graph, this.query) : null;
            if (had && !hits) this.view.select(null);
            this.view.setMatches(hits);
            const count = this.container.querySelector('.graph-search-count');
            count.textContent = hits ? (hits.size ? `${hits.size} lit · enter to jump` : 'nothing matches') : '';
        }

        bestMatch() {
            const q = this.query.trim().toLowerCase();
            const hits = this.view.matches;
            if (!hits || !hits.size) return null;
            return [...hits].map(id => this.view.byId.get(id))
                .filter(n => n && this.view.isShown(n))
                .sort((a, b) =>
                    (b.title.toLowerCase().startsWith(q) - a.title.toLowerCase().startsWith(q)) ||
                    ((a.kind === 'tag') - (b.kind === 'tag')) ||
                    (b.degree - a.degree))[0] || null;
        }

        showCard(n) {
            const card = this.container.querySelector('.graph-card');
            if (!n || !window.matchMedia?.('(pointer: coarse)').matches) { card.hidden = true; return; }
            const topic = RL.TOPICS.find(t => t.id === n.topic);
            card.querySelector('.graph-card-dot').style.background = this.view.colorOf(n);
            card.querySelector('.graph-card-title').textContent = n.title;
            card.querySelector('.graph-card-meta').textContent =
                `${n.kind === 'tag' ? 'tag' : (topic ? topic.label.toLowerCase() : 'note')} · ${n.degree} ${n.degree === 1 ? 'link' : 'links'}`;
            card.hidden = false;
        }

        open(n) {
            if (!n) return;
            const reader = window.reader;
            const inReader = reader && reader.mode === 'reader';
            if (n.kind === 'tag') {
                if (!inReader) return;
                window.garden?.hideGraph?.();
                reader.renderTag(n.id.slice(GL.TAG_PREFIX.length));
                return;
            }
            window.garden?.hideGraph?.();
            if (inReader) reader.openNote(n.id);
            else window.garden?.viewFileByPath(n.id);
        }

        show({ focus = null } = {}) {
            this.isVisible = true;
            if (!this.view) return;
            const latest = window.garden?.manifest;
            this.view.resume();
            if (latest && latest !== this.manifest) this.load(latest);
            if (focus && this.view.byId.has(focus)) this.view.focusOn(focus);
            else if (!this.view.fitted) this.view.fit(false);
        }

        hide() {
            this.isVisible = false;
            this.view?.pause();
            this.view?.setHover(null);
            const card = this.container?.querySelector('.graph-card');
            if (card) card.hidden = true;
        }

        /** The header's fit button: shake the layout loose and frame it again. */
        animate() {
            if (!this.view) return;
            this.view.reheat();
            this.view.fit(true);
        }
    }

    window.GardenGraphCanvas = GraphCanvas;
    window.KnowledgeGardenGraph = KnowledgeGardenGraph;
})();
