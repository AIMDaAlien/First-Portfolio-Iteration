/**
 * Knowledge Garden reader mode.
 *
 * A reader layer on top of the existing KnowledgeGarden instance: the mode
 * switch, the terminal hint bar, the topic sidebar, the landing view, topic
 * pages, and summary cards. Pure decisions live in garden-reader-logic.js.
 * If this file fails to load, the page works as the terminal did before.
 */
class GardenReader {
    constructor(garden) {
        this.garden = garden;
        this.logic = window.GardenReaderLogic;
        this.contentBody = document.getElementById('contentBody');
        this.breadcrumb = document.getElementById('breadcrumb');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarTitle = document.querySelector('.sidebar-title');
        this.topicList = document.getElementById('topicList');
        this.hint = document.getElementById('terminalHint');
        this.appContainer = document.querySelector('.app-container');

        this.groups = null;      // Map<topicId, { ranked, unranked }>
        this.strip = [];         // featured entries, rank order
        this.entries = [];       // every listable entry, for search
        this.activeTopic = null; // topic id shown in the sidebar
        this.searchTimer = null;
        this.snippetObserver = null;
    }

    get mode() {
        return document.documentElement.dataset.mode === 'terminal' ? 'terminal' : 'reader';
    }

    // ------------------------------------------------------------
    // Mode switch
    // ------------------------------------------------------------

    init() {
        if (!this.logic) return;

        // The head script set html[data-mode] before paint; mirror it to body.
        document.body.dataset.mode = this.mode;
        this.updateChrome();

        this.garden.requestMode = (mode) => this.setMode(mode);

        this.hint?.addEventListener('click', () => this.setMode('terminal'));

        document.addEventListener('keydown', (e) => {
            if (e.key !== '`' || e.altKey || e.ctrlKey || e.metaKey) return;
            if (this.logic.isTypingTarget(e.target)) return;
            e.preventDefault();
            this.setMode(this.mode === 'reader' ? 'terminal' : 'reader');
        });

        this.bindContentEvents();

        // Wikilinks resolve through the title index in both modes (shared renderer).
        this.index = null;
        this.garden.registerMarkdownPreprocessor((md) => (this.index ? this.logic.rewriteWikilinks(md, this.index) : md));
        this.garden.onManifestApplied = (manifest) => this.onManifestApplied(manifest);
        this.garden.onDeepLink = (path) => this.openNote(path, { push: false });
        this.garden.onRefreshRender = (path) => this.onRefreshRender(path);
        window.addEventListener('popstate', () => this.onPopState());

        this.placeHint();
        window.matchMedia('(max-width: 768px)').addEventListener('change', () => this.placeHint());

        const deepNote = this.logic.notePathFromSearch(window.location.search);
        if (this.mode === 'reader') {
            if (!deepNote) this.renderHome();
            else this.loadData().catch(() => { /* the deep-link open reports its own error */ });
        } else {
            this.loadData().catch(() => { /* terminal mode renders without the index until the next refresh */ });
        }
    }

    onManifestApplied(manifest) {
        this.applyManifest(manifest);
        if (this.mode !== 'reader' || this.garden.currentFile !== null) return;
        if (this.activeTopic) this.renderTopic(this.activeTopic);
        else this.renderHome();
    }

    /** A manifest refresh re-renders the open note in place without losing the reader header or the scroll position. */
    onRefreshRender(path) {
        if (path) return this.openNote(path, { push: false, scroll: false });
        if (this.mode === 'reader') return this.renderHome({ push: false });
        this.garden.showWelcome();
        return this.garden.loadFeaturedProjects?.();
    }

    /** The content pane is the scroller (body is overflow: hidden). */
    scrollToTop() {
        this.contentBody.scrollTop = 0;
    }

    onPopState() {
        const path = this.logic.notePathFromSearch(window.location.search);
        if (path) { this.openNote(path, { push: false }); return; }
        if (this.mode === 'reader') { this.renderHome({ push: false }); return; }
        this.garden.showWelcome();
        this.garden.loadFeaturedProjects?.();
    }

    /** Keep the address bar in step with the view so the back button works. */
    syncHistory(path) {
        const current = this.logic.notePathFromSearch(window.location.search);
        if (current === path) return;
        const url = path ? this.logic.noteHref(path) : window.location.pathname;
        try { history.pushState({ note: path }, '', url); } catch (e) { /* history blocked: links still work */ }
    }

    /** At phone width the hint moves into the sidebar drawer; otherwise it floats bottom-right. */
    placeHint() {
        if (!this.hint) return;
        const home = window.matchMedia('(max-width: 768px)').matches ? this.sidebar : this.appContainer;
        if (home && this.hint.parentElement !== home) home.appendChild(this.hint);
    }

    updateChrome() {
        if (this.sidebarTitle) this.sidebarTitle.textContent = this.mode === 'reader' ? 'Topics' : 'Files';
    }

    setMode(mode) {
        if (mode !== 'reader' && mode !== 'terminal') return;
        try { localStorage.setItem('garden-mode', mode); } catch (e) { /* storage blocked: mode lasts for this page */ }
        document.documentElement.dataset.mode = mode;
        document.body.dataset.mode = mode;
        this.updateChrome();

        const openFile = this.garden.currentFile;
        if (mode === 'terminal') {
            this.garden.closeMobileSidebar?.();
            if (openFile === null) {
                this.garden.showWelcome();
                this.garden.loadFeaturedProjects?.();
            } else {
                this.garden.viewFileByPath(openFile);
            }
            this.garden.terminalInput?.focus();
        } else if (openFile === null) {
            this.renderHome();
        } else {
            this.openNote(openFile, { push: false });
        }
    }

    // ------------------------------------------------------------
    // Data
    // ------------------------------------------------------------

    async loadData() {
        const manifest = await this.garden.fetchManifest();
        this.applyManifest(manifest);
        return manifest;
    }

    applyManifest(manifest) {
        const metadata = (manifest && manifest.metadata) || {};
        this.index = this.logic.buildTitleIndex(metadata);
        this.groups = this.logic.groupByTopic(metadata);
        this.strip = this.logic.featuredStrip(metadata, this.garden.featuredLimit || 10);
        this.entries = [];
        for (const bucket of this.groups.values()) this.entries.push(...bucket.ranked, ...bucket.unranked);
        this.renderSidebar();
    }

    topicCount(id) {
        const bucket = this.groups?.get(id);
        return bucket ? bucket.ranked.length + bucket.unranked.length : 0;
    }

    // ------------------------------------------------------------
    // Sidebar
    // ------------------------------------------------------------

    renderSidebar() {
        if (!this.topicList) return;
        const esc = this.logic.escapeHtml;
        const items = [{ id: '', label: 'Home', count: null }]
            .concat(this.logic.TOPICS.map(t => ({ id: t.id, label: t.label, count: this.topicCount(t.id) })));
        this.topicList.innerHTML = items.map(item => {
            const current = (item.id || null) === this.activeTopic ? ' aria-current="page"' : '';
            const count = item.count === null ? '' : `<span class="topic-count">${item.count}</span>`;
            return `<button type="button" class="topic-item" data-topic="${esc(item.id)}"${current}>
                <span class="topic-label">${esc(item.label)}</span>${count}
            </button>`;
        }).join('');
    }

    setActiveTopic(id) {
        this.activeTopic = id;
        this.renderSidebar();
    }

    // ------------------------------------------------------------
    // Events
    // ------------------------------------------------------------

    bindContentEvents() {
        this.topicList?.addEventListener('click', (e) => {
            const button = e.target.closest('.topic-item[data-topic]');
            if (!button) return;
            this.garden.closeMobileSidebar?.();
            if (button.dataset.topic) this.renderTopic(button.dataset.topic);
            else this.renderHome();
        });

        this.contentBody.addEventListener('click', (e) => {
            const card = e.target.closest('.reader-card[data-note]');
            if (card) { this.openNote(card.dataset.note); return; }
            const link = e.target.closest('a[data-note], a[href^="?note="]');
            if (link) {
                const path = link.dataset.note || this.logic.notePathFromSearch(link.getAttribute('href'));
                if (path) { e.preventDefault(); this.openNote(path); }
                return;
            }
            const chip = e.target.closest('.note-topic-chip[data-topic]');
            if (chip) { this.renderTopic(chip.dataset.topic); return; }
            const topic = e.target.closest('.reader-topic-card[data-topic]');
            if (topic) { this.renderTopic(topic.dataset.topic); return; }
            const retry = e.target.closest('#readerRetry');
            if (retry) this.renderHome();
        });

        this.contentBody.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.reader-card[data-note]');
            if (!card) return;
            e.preventDefault();
            this.openNote(card.dataset.note);
        });

        this.contentBody.addEventListener('input', (e) => {
            if (e.target.id !== 'readerSearch') return;
            clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(() => this.applySearch(e.target.value), 150);
        });
    }

    // ------------------------------------------------------------
    // Views
    // ------------------------------------------------------------

    setBreadcrumb(trail) {
        if (!this.breadcrumb) return;
        this.breadcrumb.innerHTML = '';
        trail.forEach((item, i) => {
            const last = i === trail.length - 1;
            const el = document.createElement(last ? 'span' : 'button');
            el.className = `breadcrumb-item${last ? ' current' : ' clickable'}`;
            el.textContent = item.label;
            if (!last) {
                el.type = 'button';
                el.addEventListener('click', item.go);
            }
            this.breadcrumb.appendChild(el);
        });
    }

    async renderHome({ push = true } = {}) {
        this.garden.currentFile = null;
        this.garden.currentPath = '';
        this.setActiveTopic(null);
        this.setBreadcrumb([{ label: 'Home' }]);
        if (push) this.syncHistory(null);
        this.scrollToTop();

        const esc = this.logic.escapeHtml;
        const intro = 'A working notebook from my homelab, my projects, and the models I run on my own hardware. Start with the featured notes, or pick a topic.';

        // Show the intro at once; a cold visitor should never see the terminal welcome while the manifest loads.
        if (!this.groups) {
            this.contentBody.innerHTML = `<div class="reader-home"><p class="reader-intro">${intro}</p><p class="muted">Loading notes…</p></div>`;
        }

        try {
            await this.loadData();
        } catch (error) {
            this.renderLoadError(error);
            return;
        }

        const topicCards = this.logic.TOPICS.map(t => {
            const n = this.topicCount(t.id);
            return `<button type="button" class="reader-topic-card" data-topic="${t.id}">
                <span class="reader-topic-label">${esc(t.label)}</span>
                <span class="reader-topic-desc">${esc(t.description)}</span>
                <span class="reader-topic-count">${n} ${n === 1 ? 'note' : 'notes'}</span>
            </button>`;
        }).join('');

        this.contentBody.innerHTML = `
            <div class="reader-home">
                <p class="reader-intro">${intro}</p>
                <input type="search" id="readerSearch" class="reader-search" placeholder="Search titles, summaries, tags" aria-label="Search notes" autocomplete="off">
                <section class="reader-results" id="readerResults" hidden aria-live="polite"></section>
                <section class="reader-featured" id="readerFeatured">
                    <h2>Featured</h2>
                    <div class="reader-grid">${this.strip.map(e => this.renderCard(e)).join('')}</div>
                </section>
                <section class="reader-topics" id="readerTopics">
                    <h2>Topics</h2>
                    <div class="reader-grid reader-grid-topics">${topicCards}</div>
                </section>
            </div>`;
        this.observeSnippets(this.contentBody);
    }

    renderLoadError(error) {
        const message = this.garden.getFriendlyError(error, 'manifest');
        this.contentBody.innerHTML = `<div class="error-content">
            <h2>Couldn't load the garden</h2>
            <p class="muted">${this.logic.escapeHtml(message)}</p>
            <button type="button" class="gallery-toggle-btn" id="readerRetry">Try again</button>
        </div>`;
    }

    applySearch(query) {
        const results = document.getElementById('readerResults');
        const featured = document.getElementById('readerFeatured');
        const topics = document.getElementById('readerTopics');
        if (!results || !featured || !topics) return;

        const q = String(query || '').trim();
        if (!q) {
            results.hidden = true;
            results.innerHTML = '';
            featured.hidden = false;
            topics.hidden = false;
            return;
        }

        const matches = this.logic.filterNotes(q, this.entries);
        const n = matches.length;
        results.innerHTML = `<h2>${n} ${n === 1 ? 'note matches' : 'notes match'}</h2>` +
            (n ? `<div class="reader-grid">${matches.map(e => this.renderCard(e)).join('')}</div>`
               : '<p class="muted">Nothing matches that yet. Try a different word, or pick a topic below.</p>');
        results.hidden = false;
        featured.hidden = true;
        topics.hidden = true;
        this.scrollToTop();
        this.observeSnippets(results);
    }

    async renderTopic(id) {
        const topic = this.logic.TOPICS.find(t => t.id === id);
        if (!topic) { this.renderHome(); return; }

        this.garden.currentFile = null;
        this.garden.currentPath = '';
        this.setActiveTopic(id);
        this.setBreadcrumb([{ label: 'Home', go: () => this.renderHome() }, { label: topic.label }]);
        this.syncHistory(null);
        this.scrollToTop();

        if (!this.groups) {
            try { await this.loadData(); } catch (error) { this.renderLoadError(error); return; }
        }

        const esc = this.logic.escapeHtml;
        const { ranked, unranked } = this.groups.get(id) || { ranked: [], unranked: [] };
        let body;
        if (ranked.length === 0 && unranked.length === 0) {
            body = '<p class="muted">No published notes here yet.</p>';
        } else {
            body = '';
            if (ranked.length) body += `<div class="reader-grid">${ranked.map(e => this.renderCard(e)).join('')}</div>`;
            if (ranked.length && unranked.length) body += '<hr class="reader-divider" data-label="More notes">';
            if (unranked.length) body += `<div class="reader-grid">${unranked.map(e => this.renderCard(e)).join('')}</div>`;
        }

        this.contentBody.innerHTML = `
            <div class="reader-topic">
                <header class="reader-topic-header">
                    <h1>${esc(topic.label)}</h1>
                    <p class="reader-intro">${esc(topic.description)}</p>
                </header>
                ${body}
            </div>`;
        this.observeSnippets(this.contentBody);
    }

    // ------------------------------------------------------------
    // Cards
    // ------------------------------------------------------------

    formatDate(value) {
        const d = this.garden.parseDate(value);
        return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    }

    renderCard(entry) {
        const esc = this.logic.escapeHtml;
        const topic = this.logic.topicForPath(entry.path);
        const accent = this.garden.getProjectColor(entry.path);
        const date = this.formatDate(entry.updated || entry.created);
        const needsSnippet = entry.summary ? '' : ' data-needs-snippet';
        return `<article class="reader-card" data-note="${esc(entry.path)}" style="--card-accent: ${accent}" tabindex="0" role="link" aria-label="Open note: ${esc(entry.title)}"${needsSnippet}>
            ${topic ? `<span class="reader-card-topic">${esc(topic.label)}</span>` : ''}
            <h3 class="reader-card-title">${esc(entry.title)}</h3>
            <p class="reader-card-summary">${esc(entry.summary || '')}</p>
            ${date ? `<span class="reader-card-date">Updated ${esc(date)}</span>` : ''}
        </article>`;
    }

    /** Fill summary-less cards with the note's first paragraph as they scroll into view. */
    observeSnippets(container) {
        const cards = container.querySelectorAll('.reader-card[data-needs-snippet]');
        if (!cards.length) return;
        if (!('IntersectionObserver' in window)) return;

        if (!this.snippetObserver) {
            this.snippetObserver = new IntersectionObserver((records) => {
                for (const record of records) {
                    if (!record.isIntersecting) continue;
                    this.snippetObserver.unobserve(record.target);
                    this.fillSnippet(record.target);
                }
            }, { rootMargin: '200px 0px' });
        }
        cards.forEach(card => this.snippetObserver.observe(card));
    }

    async fillSnippet(card) {
        const path = card.dataset.note;
        const target = card.querySelector('.reader-card-summary');
        try {
            const markdown = await this.garden.fetchNote(path);
            const snippet = this.logic.snippetFromMarkdown(markdown, 160);
            if (target && snippet && card.hasAttribute('data-needs-snippet')) target.textContent = snippet;
        } catch (error) {
            // Leave the card with title and date only.
        } finally {
            card.removeAttribute('data-needs-snippet');
        }
    }

    // ------------------------------------------------------------
    // Notes
    // ------------------------------------------------------------

    async openNote(path, { push = true, scroll = true } = {}) {
        this.garden.closeMobileSidebar?.();
        if (push) this.syncHistory(path);
        const keepScroll = scroll ? null : this.contentBody.scrollTop;
        const restoreScroll = () => { this.contentBody.scrollTop = keepScroll === null ? 0 : keepScroll; };

        if (this.mode !== 'reader') {
            await this.garden.viewFileByPath(path);
            restoreScroll();
            return;
        }

        if (!this.groups) {
            try { await this.loadData(); } catch (error) { /* header falls back to the filename */ }
        }
        const meta = this.garden.manifest?.metadata?.[path] || {};
        let text = '';
        try { text = await this.garden.fetchNote(path); } catch (error) { /* viewFileByPath shows the error under the header */ }

        const topic = this.logic.topicForPath(path);
        const headerHtml = this.renderHeader(path, meta, text);
        const afterHtml = this.renderRelated(path);
        await this.garden.viewFileByPath(path, { headerHtml, afterHtml });
        restoreScroll();

        this.setActiveTopic(topic ? topic.id : null);
        const trail = [{ label: 'Home', go: () => this.renderHome() }];
        if (topic) trail.push({ label: topic.label, go: () => this.renderTopic(topic.id) });
        trail.push({ label: this.logic.toEntry(path, meta).title });
        this.setBreadcrumb(trail);
        this.observeSnippets(this.contentBody);
    }

    renderHeader(path, meta, text) {
        const esc = this.logic.escapeHtml;
        const entry = this.logic.toEntry(path, meta);
        const topic = this.logic.topicForPath(path);

        const facts = [];
        if (entry.machine === 'bigrig') facts.push('written on BigRig');
        else if (entry.machine === 'mac') facts.push('written on the Mac');
        const created = this.formatDate(entry.created);
        const updated = this.formatDate(entry.updated);
        if (created) facts.push(`Created ${created}`);
        if (updated && updated !== created) facts.push(`Updated ${updated}`);
        if (text) facts.push(`${this.logic.readingTime(text)} min read`);

        return `<header class="note-header">
            ${topic ? `<button type="button" class="note-topic-chip" data-topic="${topic.id}">${esc(topic.label)}</button>` : ''}
            <h1>${esc(entry.title)}</h1>
            ${facts.length ? `<p class="note-meta">${facts.map(f => `<span>${esc(f)}</span>`).join('')}</p>` : ''}
            ${entry.summary ? `<p class="note-lede">${esc(entry.summary)}</p>` : ''}
            ${entry.blurb ? `<aside class="note-blurb"><h2>In plain terms</h2><p>${esc(entry.blurb)}</p></aside>` : ''}
        </header>`;
    }

    renderRelated(path) {
        const manifest = this.garden.manifest;
        if (!manifest || !this.index) return '';
        const metadata = manifest.metadata || {};
        const { outgoing, incoming } = this.logic.relatedNotes(path, metadata, manifest.links || {}, this.index, 5);
        if (!outgoing.length && !incoming.length) return '';

        const list = (title, paths) => paths.length
            ? `<h2>${title}</h2><div class="reader-grid">${paths.map(p => this.renderCard(this.logic.toEntry(p, metadata[p]))).join('')}</div>`
            : '';
        return `<section class="note-related" aria-label="Related notes">
            ${list('Links to', outgoing)}
            ${list('Linked from', incoming)}
        </section>`;
    }
}

window.reader = new GardenReader(window.garden);
window.reader.init();
