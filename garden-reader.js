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
        this.booted = false;     // the boot line plays at most once per page load
        this.bootToken = 0;
    }

    static get PROMPT_USER() { return 'aim@garden'; }
    static get INTRO() { return "my notes, straight out of the vault. the homelab, the stuff i build, and whatever i'm running on my own hardware. featured is the good stuff. know what you're after? pick a topic."; }
    static get EGGS() { return ['neofetch', 'cowsay sup', 'matrix', 'whoami', 'help']; }

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
        if (this.sidebarTitle) this.sidebarTitle.textContent = this.mode === 'reader' ? 'topics' : 'Files';
    }

    /** The git-style status bar stays in reader mode; the path reads like a shell. */
    setStatus(path, info) {
        if (this.garden.statusPath) this.garden.statusPath.textContent = path;
        if (info !== undefined && this.garden.statusInfo) this.garden.statusInfo.textContent = info;
    }

    /** The background blobs drift toward the active topic's colour. */
    tint(topicId) {
        const root = document.documentElement.style;
        if (topicId) root.setProperty('--reader-accent', this.logic.topicColor(topicId));
        else root.removeProperty('--reader-accent');
    }

    /** A card's colours: its topic, plus the mix of topics it links to. */
    accentStyle(path) {
        const manifest = this.garden.manifest || {};
        const topic = this.logic.topicForPath(path);
        const stops = this.index
            ? this.logic.accentStops(path, manifest.metadata || {}, manifest.links || {}, this.index)
            : [{ id: topic ? topic.id : null, share: 1 }];
        return `--card-accent: ${this.logic.topicColor(topic ? topic.id : null)}; --card-mix: ${this.logic.accentCss(stops)}`;
    }

    /** 'projects/penthouse' for a note path, '' at a topic root. */
    folderLabel(path) {
        return this.logic.readerPath(path).replace(/^~\/?/, '').split('/').slice(0, -1).join('/');
    }

    prompt(path, command) {
        const esc = this.logic.escapeHtml;
        return `<span class="prompt-line"><span class="prompt-user">${GardenReader.PROMPT_USER}</span>:<span class="prompt-path">${esc(path)}</span>$ <span class="prompt-cmd">${esc(command)}</span></span>`;
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
        const items = [{ id: '', label: '~ home', count: null }]
            .concat(this.logic.TOPICS.map(t => ({ id: t.id, label: t.label, count: this.topicCount(t.id) })));
        this.topicList.innerHTML = items.map(item => {
            const current = (item.id || null) === this.activeTopic ? ' aria-current="page"' : '';
            const count = item.count === null ? '' : `<span class="topic-count">${item.count}</span>`;
            const dot = item.id ? `<span class="topic-dot" style="--topic-color: ${this.logic.topicColor(item.id)}" aria-hidden="true"></span>` : '';
            return `<button type="button" class="topic-item" data-topic="${esc(item.id)}"${current}>
                <span class="topic-label">${dot}${esc(item.label)}</span>${count}
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
            const job = e.target.closest('.reader-job[data-note]');
            if (job) { this.openNote(job.dataset.note); return; }
            const topic = e.target.closest('.reader-topic-card[data-topic], .reader-load-row[data-topic]');
            if (topic) { this.renderTopic(topic.dataset.topic); return; }
            const egg = e.target.closest('.reader-egg[data-cmd]');
            if (egg) { this.runInTerminal(egg.dataset.cmd); return; }
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
        this.setBreadcrumb([{ label: '~' }]);
        if (push) this.syncHistory(null);
        this.scrollToTop();
        this.tint(null);
        this.setStatus('~', this.groups ? `${this.entries.length} notes` : 'mounting vault...');

        const esc = this.logic.escapeHtml;
        const intro = esc(GardenReader.INTRO);
        const boot = !this.booted && this.logic.shouldBoot(this.sessionStorage(), this.reducedMotion());
        const token = ++this.bootToken;

        // Show the intro at once; a cold visitor should never see the terminal welcome while the manifest loads.
        if (!this.groups) {
            this.contentBody.innerHTML = `<div class="reader-home"><pre class="reader-boot" aria-hidden="true">mounting vault…</pre>${boot ? '' : `<p class="reader-intro">${intro}</p>`}</div>`;
        }

        try {
            await this.loadData();
        } catch (error) {
            this.renderLoadError(error);
            return;
        }
        if (token !== this.bootToken) return;

        const facts = this.logic.gardenFacts(this.garden.manifest);
        this.setStatus('~', `${facts.notes} notes`);

        const eggs = GardenReader.EGGS.map(cmd =>
            `<button type="button" class="reader-egg" data-cmd="${esc(cmd)}" aria-label="run ${esc(cmd)} in the terminal">${esc(cmd)}</button>`).join('');

        this.contentBody.innerHTML = `
            <div class="reader-home${boot ? ' is-booting' : ''}">
                <section class="reader-hero">
                    <pre class="reader-boot" id="readerBoot" aria-hidden="true">mounting vault…\n${facts.notes} notes · ${facts.topics} topics · ready</pre>
                    <p class="reader-intro"><span id="readerIntroText">${boot ? '' : intro}</span>${boot ? '<span class="reader-cursor" aria-hidden="true"></span>' : ''}</p>
                    <input type="search" id="readerSearch" class="reader-search" placeholder="search titles, summaries, tags" aria-label="search notes" autocomplete="off">
                </section>
                <div class="reader-home-rest">
                    <section class="reader-results" id="readerResults" hidden aria-live="polite"></section>
                    <section class="reader-ops" id="readerFeatured">
                        <div class="reader-ops-main">
                            <aside class="reader-panel reader-operator" aria-label="about this garden">
                                <h2 class="reader-panel-label">operator</h2>
                                ${this.renderAbout(facts)}
                                <div class="reader-eggs" aria-label="terminal shortcuts">${eggs}</div>
                            </aside>
                            ${this.renderLoad()}
                        </div>
                        ${this.renderQueue()}
                    </section>
                    <section class="reader-tiles" id="readerTopics" aria-label="topics">
                        ${this.renderTiles()}
                    </section>
                </div>
            </div>`;
        this.observeSnippets(this.contentBody);
        if (boot) this.playBoot(token);
    }

    sessionStorage() {
        try { return window.sessionStorage; } catch (e) { return null; }
    }

    reducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /** First visit per session: the boot lines resolve, the intro types out, then the rest fades in. */
    async playBoot(token) {
        this.booted = true;
        try { this.sessionStorage()?.setItem('garden-booted', '1'); } catch (e) { /* private window: boot again next load */ }
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const live = () => token === this.bootToken && document.getElementById('readerIntroText');
        const home = this.contentBody.querySelector('.reader-home');
        const text = GardenReader.INTRO;
        const target = document.getElementById('readerIntroText');

        await wait(250);
        for (let i = 1; i <= text.length && live(); i++) {
            target.textContent = text.slice(0, i);
            await wait(text[i - 1] === '.' ? 60 : 5);
        }
        if (!live()) return;
        target.textContent = text;
        this.contentBody.querySelector('.reader-cursor')?.remove();
        home?.classList.remove('is-booting');
    }

    /** neofetch for the vault: patchy on the left, live numbers from the manifest on the right. */
    renderAbout(facts) {
        const esc = this.logic.escapeHtml;
        const when = facts.generated ? this.formatStamp(facts.generated) : 'unknown';
        const rows = [
            ['notes', String(facts.notes)],
            ['topics', String(facts.topics)],
            ['featured', String(facts.featured)],
            ['written', facts.machines.length ? facts.machines.join(' · ') : 'mac'],
            ['published', when],
            ['shell', 'zsh, press `'],
        ];
        const width = Math.max(...rows.map(([k]) => k.length)) + 1;
        const lines = [`<span class="about-user">${GardenReader.PROMPT_USER}</span>`, '<span class="about-rule">----------</span>']
            .concat(rows.map(([k, v]) => `<span class="about-key">${esc(k.padEnd(width))}</span> ${esc(v)}`));
        return `<div class="reader-fetch">
            <img class="reader-patchy" src="patchy-fumo.jpg" width="480" height="480" alt="a patchouli knowledge fumo plush in round glasses, reading a book">
            <div class="reader-fetch-side">
                <span class="reader-bubble" lang="ja">むきゅー</span>
                <pre class="reader-neofetch">${lines.join('\n')}</pre>
            </div>
        </div>`;
    }

    /** One bar per topic, sized against the biggest; each bar opens its topic. */
    renderLoad() {
        const esc = this.logic.escapeHtml;
        const rows = this.logic.topicLoad(this.garden.manifest.metadata).map(r =>
            `<button type="button" class="reader-load-row" data-topic="${r.id}" style="--bar-color: ${this.logic.topicColor(r.id)}; --bar-share: ${(r.share * 100).toFixed(1)}%">
                <span class="reader-load-label">${esc(r.label)}</span>
                <span class="reader-load-bar" aria-hidden="true"><span></span></span>
                <span class="reader-load-count">${r.count}</span>
            </button>`).join('');
        return `<section class="reader-panel reader-load" aria-label="notes per topic">
            <h2 class="reader-panel-label">vault load</h2>
            ${rows}
        </section>`;
    }

    /** The featured strip as a ranked queue under a hazard stripe. */
    renderQueue() {
        const esc = this.logic.escapeHtml;
        const rows = this.strip.map(e => {
            const topic = this.logic.topicForPath(e.path);
            return `<button type="button" class="reader-job" data-note="${esc(e.path)}" style="${this.accentStyle(e.path)}">
                <span class="reader-job-rank">${String(e.featured).padStart(2, '0')}</span>
                <span class="reader-job-text">
                    <span class="reader-job-title">${esc(e.title)}</span>
                    ${e.summary ? `<span class="reader-job-summary">${esc(e.summary)}</span>` : ''}
                </span>
                <span class="reader-job-topic">${esc(topic ? topic.id : '')}</span>
            </button>`;
        }).join('');
        return `<section class="reader-panel reader-queue" aria-label="featured notes">
            <span class="reader-hazard" aria-hidden="true"></span>
            <h2 class="reader-panel-label">featured · the good stuff</h2>
            ${rows}
        </section>`;
    }

    /** Topic tiles with big counts. */
    renderTiles() {
        const esc = this.logic.escapeHtml;
        return this.logic.TOPICS.map(t => {
            const n = this.topicCount(t.id);
            return `<button type="button" class="reader-topic-card reader-tile" data-topic="${t.id}" style="--card-accent: ${this.logic.topicColor(t.id)}">
                <span class="reader-topic-label">${esc(t.label)}/</span>
                <span class="reader-topic-desc">${esc(t.description)}</span>
                <span class="reader-tile-count">${n}</span>
            </button>`;
        }).join('');
    }

    formatStamp(value) {
        const d = this.garden.parseDate(value);
        if (!d) return String(value);
        const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();
        const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).toLowerCase();
        return `${date}, ${time}`;
    }

    /** The easter eggs are one click away: open the terminal and run the command there. */
    runInTerminal(cmd) {
        this.setMode('terminal');
        this.garden.floatingTerminal?.classList.remove('minimized');
        this.garden.executeCommand(cmd);
        this.garden.terminalInput?.focus();
    }

    renderLoadError(error) {
        const message = this.garden.getFriendlyError(error, 'manifest');
        this.contentBody.innerHTML = `<div class="error-content">
            <h2>couldn't load the garden</h2>
            <p class="muted">${this.logic.escapeHtml(message)}</p>
            <button type="button" class="gallery-toggle-btn" id="readerRetry">try again</button>
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
        results.innerHTML = `<h2 class="reader-prompt">${this.prompt('~', `grep -ri "${q}"`)}<span class="reader-group-count">${n} ${n === 1 ? 'note' : 'notes'}</span></h2>` +
            (n ? `<div class="reader-grid">${matches.map(e => this.renderCard(e, { showFolder: true })).join('')}</div>`
               : '<p class="muted">nothing matches that. try another word, or pick a topic.</p>');
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
        this.setBreadcrumb([{ label: '~', go: () => this.renderHome() }, { label: topic.label }]);
        this.syncHistory(null);
        this.scrollToTop();
        this.tint(id);
        this.bootToken++;

        if (!this.groups) {
            try { await this.loadData(); } catch (error) { this.renderLoadError(error); return; }
        }

        const esc = this.logic.escapeHtml;
        const manifest = this.garden.manifest || {};
        const { ranked, unranked } = this.groups.get(id) || { ranked: [], unranked: [] };
        const groups = this.logic.groupByFolder(ranked.concat(unranked), id, manifest.metadata || {}, manifest.links || {}, this.index);
        const total = ranked.length + unranked.length;
        const home = `~/${id}`;
        this.setStatus(home, `${total} ${total === 1 ? 'note' : 'notes'}${groups.length > 1 ? ` · ${groups.length} folders` : ''}`);

        let body;
        if (groups.length === 0) {
            body = '<p class="muted">nothing published here yet. soon.</p>';
        } else if (groups.length === 1 && groups[0].key === '') {
            body = `<div class="reader-grid">${groups[0].entries.map(e => this.renderCard(e)).join('')}</div>`;
        } else {
            body = groups.map(g => `<section class="reader-group" aria-label="${esc(g.label)}">
                <h2 class="reader-prompt">${this.prompt(home, `ls ${g.label}`)}<span class="reader-group-count">${g.entries.length} ${g.entries.length === 1 ? 'note' : 'notes'}</span></h2>
                <div class="reader-grid">${g.entries.map(e => this.renderCard(e)).join('')}</div>
            </section>`).join('');
        }

        this.contentBody.innerHTML = `
            <div class="reader-topic" style="--card-accent: ${this.logic.topicColor(id)}">
                <header class="reader-topic-header">
                    <p class="reader-prompt">${this.prompt('~', `cd ${id}`)}</p>
                    <h1>${esc(topic.label)}/</h1>
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
        return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase() : '';
    }

    renderCard(entry, { showFolder = false } = {}) {
        const esc = this.logic.escapeHtml;
        const topic = this.logic.topicForPath(entry.path);
        const label = showFolder ? this.folderLabel(entry.path) : (topic ? topic.label : '');
        const date = this.formatDate(entry.updated || entry.created);
        const needsSnippet = entry.summary ? '' : ' data-needs-snippet';
        return `<article class="reader-card" data-note="${esc(entry.path)}" style="${this.accentStyle(entry.path)}" tabindex="0" role="link" aria-label="open note: ${esc(entry.title)}"${needsSnippet}>
            ${label ? `<span class="reader-card-topic">${esc(label)}/</span>` : ''}
            <h3 class="reader-card-title">${esc(entry.title)}</h3>
            <p class="reader-card-summary">${esc(entry.summary || '')}</p>
            ${date ? `<span class="reader-card-date">updated ${esc(date)}</span>` : ''}
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
        this.bootToken++;
        await this.garden.viewFileByPath(path, { headerHtml, afterHtml });
        restoreScroll();
        this.tint(topic ? topic.id : null);
        this.setStatus(this.logic.readerPath(path));

        this.setActiveTopic(topic ? topic.id : null);
        const trail = [{ label: '~', go: () => this.renderHome() }];
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
        if (entry.machine) facts.push(`written on ${entry.machine}`);
        const created = this.formatDate(entry.created);
        const updated = this.formatDate(entry.updated);
        if (created) facts.push(`created ${created}`);
        if (updated && updated !== created) facts.push(`updated ${updated}`);
        if (text) facts.push(`${this.logic.readingTime(text)} min read`);
        const folder = this.folderLabel(path);

        return `<header class="note-header" style="${this.accentStyle(path)}">
            <p class="reader-prompt">${this.prompt('~', `cat ${this.logic.readerPath(path).replace(/^~\//, '')}`)}</p>
            ${topic ? `<button type="button" class="note-topic-chip" data-topic="${topic.id}">${esc(folder || topic.label)}/</button>` : ''}
            <h1>${esc(entry.title)}</h1>
            ${facts.length ? `<p class="note-meta">${facts.map(f => `<span>${esc(f)}</span>`).join('')}</p>` : ''}
            ${entry.summary ? `<p class="note-lede">${esc(entry.summary)}</p>` : ''}
            ${entry.blurb ? `<aside class="note-blurb"><h2>in plain terms</h2><p>${esc(entry.blurb)}</p></aside>` : ''}
        </header>`;
    }

    renderRelated(path) {
        const manifest = this.garden.manifest;
        if (!manifest || !this.index) return '';
        const metadata = manifest.metadata || {};
        const { outgoing, incoming } = this.logic.relatedNotes(path, metadata, manifest.links || {}, this.index, 5);
        if (!outgoing.length && !incoming.length) return '';

        const list = (title, paths) => paths.length
            ? `<h2 class="reader-prompt">${this.prompt('~', title)}<span class="reader-group-count">${paths.length} ${paths.length === 1 ? 'note' : 'notes'}</span></h2><div class="reader-grid">${paths.map(p => this.renderCard(this.logic.toEntry(p, metadata[p]), { showFolder: true })).join('')}</div>`
            : '';
        return `<section class="note-related" aria-label="related notes">
            ${list('ls links-out/', outgoing)}
            ${list('ls links-in/', incoming)}
        </section>`;
    }
}

window.reader = new GardenReader(window.garden);
window.reader.init();
