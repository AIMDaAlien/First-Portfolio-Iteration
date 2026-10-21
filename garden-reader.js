/**
 * Knowledge Garden reader mode.
 *
 * A reader layer on top of the existing KnowledgeGarden instance: the mode
 * switch and the terminal hint bar live here. Landing view, topic pages, and
 * note headers follow in later steps. If this file fails to load, the page
 * works as the terminal did before.
 */
class GardenReader {
    constructor(garden) {
        this.garden = garden;
        this.logic = window.GardenReaderLogic;
        this.contentBody = document.getElementById('contentBody');
        this.sidebar = document.getElementById('sidebar');
        this.hint = document.getElementById('terminalHint');
        this.appContainer = document.querySelector('.app-container');
    }

    get mode() {
        return document.documentElement.dataset.mode === 'terminal' ? 'terminal' : 'reader';
    }

    init() {
        if (!this.logic) return;

        // The head script set html[data-mode] before paint; mirror it to body.
        document.body.dataset.mode = this.mode;

        this.garden.requestMode = (mode) => this.setMode(mode);

        this.hint?.addEventListener('click', () => this.setMode('terminal'));

        document.addEventListener('keydown', (e) => {
            if (e.key !== '`' || e.altKey || e.ctrlKey || e.metaKey) return;
            if (this.logic.isTypingTarget(e.target)) return;
            e.preventDefault();
            this.setMode(this.mode === 'reader' ? 'terminal' : 'reader');
        });

        this.placeHint();
        this.narrow = window.matchMedia('(max-width: 768px)');
        this.narrow.addEventListener('change', () => this.placeHint());

        if (this.mode === 'reader') this.renderHome();
    }

    /** At phone width the hint moves into the sidebar drawer; otherwise it floats bottom-right. */
    placeHint() {
        if (!this.hint) return;
        const home = window.matchMedia('(max-width: 768px)').matches ? this.sidebar : this.appContainer;
        if (home && this.hint.parentElement !== home) home.appendChild(this.hint);
    }

    setMode(mode) {
        if (mode !== 'reader' && mode !== 'terminal') return;
        try { localStorage.setItem('garden-mode', mode); } catch (e) { /* storage blocked: mode lasts for this page */ }
        document.documentElement.dataset.mode = mode;
        document.body.dataset.mode = mode;

        const noteOpen = this.garden.currentFile !== null;
        if (mode === 'terminal') {
            this.garden.closeMobileSidebar?.();
            if (!noteOpen) {
                this.garden.showWelcome();
                this.garden.loadFeaturedProjects?.();
            }
            this.garden.terminalInput?.focus();
        } else if (!noteOpen) {
            this.renderHome();
        }
    }

    renderHome() {
        this.garden.currentFile = null;
        this.contentBody.innerHTML = '<h1>Knowledge Garden</h1>';
    }
}

window.reader = new GardenReader(window.garden);
window.reader.init();
