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

    // Drag by (dx, dy) within limits. Per axis the offset may reach the larger of:
    // the gap between image and viewport (a small image slides to the viewport edge,
    // a big one until its own edge arrives), and how much zooming grew the image,
    // w*(s-1)/2, which is exactly what a zoom anchored on the image needs.
    function panBy(state, dx, dy, bounds) {
        const limit = (size, view) => Math.max(Math.abs(size * state.s - view) / 2, size * (state.s - 1) / 2);
        const maxX = limit(bounds.w, bounds.vw);
        const maxY = limit(bounds.h, bounds.vh);
        const clamp = (v, m) => Math.min(m, Math.max(-m, v)) + 0;
        return { s: state.s, x: clamp(state.x + dx, maxX), y: clamp(state.y + dy, maxY) };
    }

    const HomeDoorsLogic = { DOORS, pickDoor, doorSearch, doorForHash, clampZoom, zoomAt, panBy };

    if (typeof module !== 'undefined') module.exports = HomeDoorsLogic;
    if (typeof window !== 'undefined') window.HomeDoorsLogic = HomeDoorsLogic;
})();
