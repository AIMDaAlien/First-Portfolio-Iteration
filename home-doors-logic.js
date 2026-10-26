/**
 * Front page "two doors" logic: which door (the short version or the deep end)
 * a visitor lands on, the URL that remembers it, which door a section lives
 * in, and the zoom/pan math for the chart viewer. Pure functions, loaded as a
 * plain script (window.HomeDoorsLogic) and by the node:test suite.
 */
(function () {
    const DOORS = ['short', 'deep'];
    const DEFAULT_DOOR = 'short';
    const MIN_ZOOM = 1;
    const MAX_ZOOM = 6;

    const SECTION_DOORS = {
        about: 'short',
        done: 'short',
        experience: 'short',
        'garden-invite': 'short',
        lab: 'deep',
        'machine-spec': 'deep',
        skills: 'deep',
        projects: 'deep',
        'knowledge-garden-showcase': 'deep',
    };

    const isDoor = (value) => DOORS.includes(value);

    // The URL's ?door= wins, then the visitor's last pick, then the short version.
    function pickDoor(search, stored) {
        const fromUrl = new URLSearchParams(String(search || '')).get('door');
        if (isDoor(fromUrl)) return fromUrl;
        if (isDoor(stored)) return stored;
        return DEFAULT_DOOR;
    }

    // The query string after switching doors: door=deep is shareable, short is the bare URL.
    function doorSearch(search, door) {
        const params = new URLSearchParams(String(search || ''));
        params.delete('door');
        if (door === 'deep') params.set('door', 'deep');
        const query = params.toString();
        return query ? '?' + query : '';
    }

    // Which door holds the section a #hash points at; null for shared sections.
    function doorForHash(hash) {
        const id = String(hash || '').replace(/^#/, '');
        return SECTION_DOORS[id] || null;
    }

    function clampZoom(s) {
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s));
    }

    // Zoom by `factor` about (px, py), measured from the image centre in screen
    // pixels, so the point under the cursor stays put. Back at 1x it recentres.
    function zoomAt(state, factor, px, py) {
        const s = clampZoom(state.s * factor);
        if (s === MIN_ZOOM) return { s, x: 0, y: 0 };
        const k = s / state.s;
        return { s, x: px - (px - state.x) * k, y: py - (py - state.y) * k };
    }

    // Drag by (dx, dy) without pulling the scaled image's edge inside the viewport.
    function panBy(state, dx, dy, bounds) {
        const maxX = Math.max(0, (bounds.w * state.s - bounds.vw) / 2);
        const maxY = Math.max(0, (bounds.h * state.s - bounds.vh) / 2);
        const clamp = (v, m) => Math.min(m, Math.max(-m, v)) + 0;
        return { s: state.s, x: clamp(state.x + dx, maxX), y: clamp(state.y + dy, maxY) };
    }

    const HomeDoorsLogic = { DOORS, pickDoor, doorSearch, doorForHash, clampZoom, zoomAt, panBy };

    if (typeof module !== 'undefined') module.exports = HomeDoorsLogic;
    if (typeof window !== 'undefined') window.HomeDoorsLogic = HomeDoorsLogic;
})();
