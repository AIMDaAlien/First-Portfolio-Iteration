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
    function scrollToHash(hash, tries = 15) {
        const target = hash && document.getElementById(hash.slice(1));
        if (!target) return;
        const navHeight = document.getElementById('main-nav')?.offsetHeight || 0;
        const offset = target.getBoundingClientRect().top - navHeight;
        if (Math.abs(offset) <= 4) return;
        window.scrollTo({ top: offset + window.scrollY, behavior: 'instant' });
        if (tries > 0) setTimeout(() => scrollToHash(hash, tries - 1), 200);
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!Logic || !document.querySelector('[data-door-panel]')) return;

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
