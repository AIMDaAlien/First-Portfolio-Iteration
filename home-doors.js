/**
 * Front page "two doors": the short version and the deep end. Opens the right
 * door on load (?door=, a #section link, or the visitor's last pick), switches
 * on the door buttons, and opens the other door when a link points into it.
 * Decisions live in home-doors-logic.js; this file only touches the DOM.
 */
(function () {
    const Logic = window.HomeDoorsLogic;
    const STORAGE_KEY = 'home-door';
    const HINTS = {
        short: 'plain words, big numbers &middot; 2 min read &middot; <span class="nudge">the charts live in the deep end</span>',
        deep: 'charts, specs, telemetry &middot; bring coffee',
    };
    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function readStored() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }
    function writeStored(door) {
        try { localStorage.setItem(STORAGE_KEY, door); } catch (e) { /* private mode: the URL still carries it */ }
    }

    let current = null;

    function open(door, opts = {}) {
        if (!Logic.DOORS.includes(door)) return;
        const changed = door !== current;
        current = door;
        document.querySelectorAll('[data-door-panel]').forEach(panel => {
            panel.hidden = panel.dataset.doorPanel !== door;
        });
        document.querySelectorAll('.door-buttons [data-door]').forEach(btn => {
            btn.setAttribute('aria-pressed', String(btn.dataset.door === door));
        });
        const hint = document.getElementById('doorHint');
        if (hint) hint.innerHTML = HINTS[door];
        if (opts.remember !== false) {
            writeStored(door);
            try {
                history.replaceState(history.state, '', location.pathname + Logic.doorSearch(location.search, door) + location.hash);
            } catch (e) { /* file:// or sandboxed: leave the URL alone */ }
        }
        if (changed) document.dispatchEvent(new CustomEvent('door:change', { detail: { door } }));
        if (opts.scroll) {
            const sw = document.querySelector('.door-switch');
            const navHeight = document.getElementById('main-nav')?.offsetHeight || 0;
            if (sw) window.scrollTo({ top: sw.getBoundingClientRect().top + window.scrollY - navHeight - 16, behavior: reducedMotion() ? 'auto' : 'smooth' });
        }
    }

    // The page body stays hidden until the boot sequence reveals it; wait for that before scrolling.
    function whenVisible(fn, tries = 0) {
        const main = document.getElementById('main-content');
        if (!main || main.offsetParent !== null || getComputedStyle(main).display !== 'none' || tries > 200) {
            requestAnimationFrame(fn);
        } else {
            setTimeout(() => whenVisible(fn, tries + 1), 50);
        }
    }

    // Jump (not smooth-scroll) to a section. The boot intro can hold scrolling for a
    // moment after the page appears, so keep trying until the section is in place.
    // Once the visitor scrolls on their own, stop: never pull them back to the section.
    let lastUserScroll = 0;
    const markUserScroll = () => { lastUserScroll = performance.now(); };
    ['wheel', 'touchmove'].forEach(type => window.addEventListener(type, markUserScroll, { passive: true }));
    window.addEventListener('keydown', e => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) markUserScroll();
    });

    function scrollToHash(hash, tries = 15, startedAt = performance.now()) {
        const target = hash && document.getElementById(hash.slice(1));
        if (!target || lastUserScroll > startedAt) return;
        const navHeight = document.getElementById('main-nav')?.offsetHeight || 0;
        const offset = target.getBoundingClientRect().top - navHeight;
        if (Math.abs(offset) <= 4) return;
        window.scrollTo({ top: offset + window.scrollY, behavior: 'instant' });
        if (tries > 0) setTimeout(() => scrollToHash(hash, tries - 1, startedAt), 200);
    }


    // --- Chart viewer: zoom with wheel, pinch, +/- or double-click; drag to pan ---
    function initChartViewer() {
        const dialog = document.getElementById('chartZoom');
        const img = document.getElementById('chartZoomImg');
        const noteLink = document.getElementById('chartZoomNote');
        if (!dialog || !img) return;
        // Fixed positioning breaks under a transformed ancestor, so the viewer lives on <body>.
        document.body.appendChild(dialog);

        let state = { s: 1, x: 0, y: 0 };
        let opener = null;
        const pointers = new Map();
        let pinch = null;

        const bounds = () => ({ w: img.offsetWidth, h: img.offsetHeight, vw: window.innerWidth, vh: window.innerHeight });
        const fromCentre = (clientX, clientY) => ({ px: clientX - window.innerWidth / 2, py: clientY - window.innerHeight / 2 });
        const apply = () => {
            img.style.transform = `translate(calc(-50% + ${state.x}px), calc(-50% + ${state.y}px)) scale(${state.s})`;
        };
        const set = (next) => { state = Logic.panBy(next, 0, 0, bounds()); apply(); };
        const zoomBy = (factor, clientX = window.innerWidth / 2, clientY = window.innerHeight / 2) => {
            const { px, py } = fromCentre(clientX, clientY);
            set(Logic.zoomAt(state, factor, px, py));
        };

        function openViewer(chart) {
            const source = chart.querySelector('img');
            if (!source || chart.classList.contains('chart--missing')) return;
            opener = chart;
            img.src = source.currentSrc || source.src;
            img.alt = source.alt;
            noteLink.href = chart.dataset.note || '#';
            state = { s: 1, x: 0, y: 0 };
            apply();
            dialog.hidden = false;
            document.body.style.overflow = 'hidden';
            // Everything behind the viewer is unreachable by keyboard and screen reader while it is open.
            for (const el of document.body.children) if (el !== dialog) el.inert = true;
            dialog.querySelector('[data-zoom="close"]').focus();
        }

        function closeViewer() {
            if (dialog.hidden) return;
            dialog.hidden = true;
            document.body.style.overflow = '';
            for (const el of document.body.children) el.inert = false;
            pointers.clear();
            pinch = null;
            if (opener) opener.focus();
        }

        document.querySelectorAll('.lab-card .chart').forEach(chart => {
            const source = chart.querySelector('img');
            chart.tabIndex = 0;
            chart.setAttribute('role', 'button');
            chart.setAttribute('aria-label', 'zoom chart: ' + (source?.alt || 'chart'));
            const markMissing = () => {
                chart.classList.add('chart--missing');
                chart.removeAttribute('role');
                chart.tabIndex = -1;
            };
            if (source) {
                source.addEventListener('error', markMissing);
                if (source.complete && source.naturalWidth === 0 && source.getAttribute('src')) markMissing();
            }
            chart.addEventListener('click', () => openViewer(chart));
            chart.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openViewer(chart); }
            });
        });

        // Pointer capture retargets click/dblclick to the dialog, so remember where the
        // press started: only a still press that began on the backdrop closes the viewer.
        let moved = false;
        let downOn = null;

        dialog.addEventListener('click', e => {
            const action = e.target.closest('[data-zoom]')?.dataset.zoom;
            if (action === 'in') zoomBy(1.4);
            else if (action === 'out') zoomBy(1 / 1.4);
            else if (action === 'fit') set({ s: 1, x: 0, y: 0 });
            else if (action === 'close') closeViewer();
            else if (!action && downOn === 'backdrop' && !moved) closeViewer();
        });

        dialog.addEventListener('wheel', e => {
            e.preventDefault();
            zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
        }, { passive: false });

        dialog.addEventListener('dblclick', e => {
            if (downOn !== 'image') return;
            if (state.s > 1) set({ s: 1, x: 0, y: 0 });
            else zoomBy(2.5, e.clientX, e.clientY);
        });

        // Pointer handling is on the whole viewer, so a pinch can start anywhere on screen.
        const onBar = e => Boolean(e.target.closest('.zoom-bar'));
        dialog.addEventListener('pointerdown', e => {
            if (onBar(e)) return;
            dialog.setPointerCapture(e.pointerId);
            if (!pointers.size) {
                moved = false;
                downOn = e.target === img ? 'image' : 'backdrop';
            }
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
            if (pointers.size === 2) {
                const [a, b] = [...pointers.values()];
                pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
            }
            dialog.classList.add('is-dragging');
        });

        dialog.addEventListener('pointermove', e => {
            const prev = pointers.get(e.pointerId);
            if (!prev) return;
            if (Math.hypot(e.clientX - prev.x0, e.clientY - prev.y0) > 6) moved = true;
            pointers.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY });
            if (pointers.size === 2 && pinch) {
                const [a, b] = [...pointers.values()];
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                const { px, py } = fromCentre(mid.x, mid.y);
                const zoomed = Logic.zoomAt(state, dist / (pinch.dist || dist), px, py);
                set(Logic.panBy(zoomed, mid.x - pinch.mid.x, mid.y - pinch.mid.y, bounds()));
                pinch = { dist, mid };
            } else if (pointers.size === 1 && state.s > 1) {
                set(Logic.panBy(state, e.clientX - prev.x, e.clientY - prev.y, bounds()));
            }
        });

        const release = e => {
            pointers.delete(e.pointerId);
            if (pointers.size < 2) pinch = null;
            if (!pointers.size) dialog.classList.remove('is-dragging');
        };
        dialog.addEventListener('pointerup', release);
        dialog.addEventListener('pointercancel', release);

        document.addEventListener('keydown', e => {
            if (dialog.hidden) return;
            if (e.key === 'Escape') { e.preventDefault(); closeViewer(); return; }
            if (e.key === 'Tab') {
                const focusable = [...dialog.querySelectorAll('button, a[href]')];
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                const inside = dialog.contains(document.activeElement) && document.activeElement !== dialog;
                if (!inside) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
                else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!Logic || !document.querySelector('[data-door-panel]')) return;

        initChartViewer();

        const hashDoor = Logic.doorForHash(location.hash);
        open(hashDoor || Logic.pickDoor(location.search, readStored()), { remember: Boolean(hashDoor) || /[?&]door=/.test(location.search) });
        if (hashDoor) whenVisible(() => scrollToHash(location.hash));

        // Door buttons, including the nudge at the end of the short version.
        document.addEventListener('click', e => {
            const btn = e.target.closest('[data-door]');
            if (btn && !btn.matches('[data-door-panel]')) {
                e.preventDefault();
                open(btn.dataset.door, { scroll: true });
            }
        });

        // A #link into the closed door opens that door first. Capture phase, so the
        // nav's own smooth-scroll handler then measures the now-visible section.
        document.addEventListener('click', e => {
            const link = e.target.closest('a[href^="#"]');
            if (!link) return;
            const door = Logic.doorForHash(link.getAttribute('href'));
            if (door && door !== current) open(door);
        }, true);

        window.addEventListener('hashchange', () => {
            const door = Logic.doorForHash(location.hash);
            if (door && door !== current) {
                open(door);
                const hash = location.hash;
                whenVisible(() => scrollToHash(hash));
            }
        });
    });

    window.HomeDoors = { open: (door, opts) => open(door, opts) };
})();
