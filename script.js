document.addEventListener('DOMContentLoaded', () => {
    // --- Cached DOM Elements ---
    const loader = document.getElementById('loader');
    const startupIntro = document.getElementById('startup-intro');
    const startupQuote = document.getElementById('startup-quote');
    const startupQuoter = document.getElementById('startup-quoter');
    const mainContent = document.getElementById('main-content');
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    const mainNav = document.getElementById('main-nav');
    const navLinks = Array.from(document.querySelectorAll('.nav-link'));
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const mobileNavUl = document.querySelector('#main-nav ul');
    const cursorAura = document.getElementById('cursor-aura');
    const animatedElements = Array.from(document.querySelectorAll('.animate-on-scroll'));
    const pageSections = Array.from(document.querySelectorAll('section[id]'));
    const interactiveElements = Array.from(document.querySelectorAll(
        'a, button, .stat-card, .skill-category, .project-card, .timeline-item, .section-title, .nav-link, .hamburger-menu'
    ));
    const cards = Array.from(document.querySelectorAll('.stat-card, .skill-category, .project-card'));

    // --- Typing Effect for Subtitle ---
    function typeSubtitle(text, speed = 50) {
        const typedElement = document.getElementById('typed-subtitle');
        if (!typedElement) return;

        let i = 0;
        function type() {
            if (i < text.length) {
                typedElement.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        type();
    }

    // --- Section Offsets for Scroll Tracking ---
    let sectionOffsets = [];
    function cacheSectionOffsets() {
        sectionOffsets = pageSections.map(section => ({
            id: section.id,
            offsetTop: section.offsetTop - mainNav.offsetHeight - 50
        }));
    }
    window.addEventListener('resize', cacheSectionOffsets);
    cacheSectionOffsets();

    // --- Loading and Startup Sequence ---
    function startWebsite() {
        const biosScreen = document.getElementById('bios-screen');
        const biosLines = document.querySelectorAll('.bios-line');

        // Hide loader
        loader.style.transition = 'opacity 0.5s ease-out';
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 500);

        // Show BIOS screen
        biosScreen.style.opacity = '1';

        // Animate BIOS lines
        biosLines.forEach((line, index) => {
            const delay = parseInt(line.dataset.delay) || index * 200;
            setTimeout(() => {
                line.classList.add('visible');
            }, delay);
        });

        // After last BIOS line, transition to quote
        const lastLineDelay = Math.max(...Array.from(biosLines).map(l => parseInt(l.dataset.delay) || 0));
        const biosEndDelay = lastLineDelay + 1000; // 1s after last line

        setTimeout(() => {
            // Fade out BIOS
            biosScreen.style.transition = 'opacity 0.5s ease-out';
            biosScreen.style.opacity = '0';

            setTimeout(() => {
                biosScreen.style.display = 'none';

                // Skip quote - go directly to CRT transition
                startupIntro.style.opacity = '1';
                startupIntro.classList.add('crt-off');

                setTimeout(() => {
                    startupIntro.style.display = 'none';
                    mainContent.style.display = 'block';

                    // Pre-warm hero animations immediately
                    const heroSection = document.getElementById('hero');
                    if (heroSection) heroSection.classList.add('section-visible');

                    setTimeout(() => {
                        mainNav.classList.add('visible');

                        if (heroTitle && heroTitle.textContent) {
                            const heroText = heroTitle.textContent;
                            heroTitle.innerHTML = heroText.split('').map((char, i) =>
                                `<span style="transition-delay: ${i * 50}ms">${char === ' ' ? '&nbsp;' : char}</span>`
                            ).join('');
                        }

                        if (heroTitle) {
                            heroTitle.style.opacity = '1';
                            heroTitle.style.transform = 'translateY(0) scale(1)';
                            heroTitle.classList.add('visible');
                        }
                        if (heroSubtitle) {
                            heroSubtitle.style.opacity = '1';
                            heroSubtitle.style.transform = 'translateY(0) scale(1)';
                            typeSubtitle('Builder working across self-hosted infrastructure, AI orchestration, and live app deployment.');
                        }
                        if (scrollIndicator) {
                            scrollIndicator.style.opacity = '1';
                        }

                        checkElementsVisibility();
                        initSectionVisibilityObserver();
                    }, 500);
                }, 900);
            }, 500); // Wait for BIOS fade out
        }, biosEndDelay);
    }

    setTimeout(startWebsite, 200);

    // --- Optimized Navigation Scroll Active State ---
    function updateActiveNavLink() {
        const scrollY = window.scrollY;
        let currentSectionId = '';

        for (let i = 0; i < sectionOffsets.length; i++) {
            if (scrollY >= sectionOffsets[i].offsetTop) {
                currentSectionId = sectionOffsets[i].id;
            }
        }

        navLinks.forEach(link => {
            const isActive = link.getAttribute('href') === `#${currentSectionId}`;
            link.classList.toggle('active', isActive);
        });

        mainNav.classList.toggle('scrolled', scrollY > 50);
    }

    // --- Hamburger Menu Toggle ---
    if (hamburgerMenu && mobileNavUl) {
        hamburgerMenu.addEventListener('click', () => {
            const isActive = hamburgerMenu.classList.toggle('active');
            mobileNavUl.classList.toggle('active');
            hamburgerMenu.setAttribute('aria-expanded', isActive);
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (hamburgerMenu && mobileNavUl && hamburgerMenu.classList.contains('active')) {
                hamburgerMenu.classList.remove('active');
                mobileNavUl.classList.remove('active');
                hamburgerMenu.setAttribute('aria-expanded', 'false');
            }
        });
    });

    // --- Scroll-Triggered Animations (cleaned logic) ---
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    function handleIntersect(entries, observer) {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const siblings = Array.from(el.parentElement.children);
                const delay = el.classList.contains('stagger') ? (siblings.indexOf(el) * 150) : 0;
                setTimeout(() => {
                    el.classList.add('is-visible');
                }, delay);
                observer.unobserve(el);
            }
        });
    }

    const scrollObserver = new IntersectionObserver(handleIntersect, observerOptions);

    function checkElementsVisibility() {
        animatedElements.forEach(el => {
            if (!el.classList.contains('is-visible')) {
                scrollObserver.observe(el);
            }
        });
    }

    checkElementsVisibility();

    // --- Smooth Scrolling for Nav Links ---
    navLinks.forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('#') && href.length > 1) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    const navHeight = mainNav ? mainNav.offsetHeight : 0;
                    const targetElementStyle = window.getComputedStyle(targetElement);
                    const targetElementMarginTop = parseInt(targetElementStyle.marginTop, 10) || 0;
                    const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
                    const offsetPosition = elementPosition - navHeight - targetElementMarginTop;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // --- Optimized Cursor Aura + Dot ---
    const canUseCustomCursor = window.matchMedia('(pointer: fine)').matches &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (cursorAura && canUseCustomCursor) {
        // Create the exact-position dot if it doesn't exist.
        let cursorDot = document.getElementById('cursor-dot');
        if (!cursorDot) {
            cursorDot = document.createElement('div');
            cursorDot.id = 'cursor-dot';
            document.body.appendChild(cursorDot);
        }

        document.body.style.cursor = 'none';

        let auraX = window.innerWidth / 2;
        let auraY = window.innerHeight / 2;
        let targetX = auraX;
        let targetY = auraY;
        let pointerLocked = false;
        let auraIdle = false;
        let lastMove = Date.now();

        // Lower lerp = softer, more liquid follow; the dot itself is still exact.
        const AURA_LERP = 0.22;

        document.addEventListener('mousemove', (e) => {
            lastMove = Date.now();
            if (!pointerLocked) {
                targetX = e.clientX;
                targetY = e.clientY;
            } else {
                targetX += e.movementX;
                targetY += e.movementY;
                targetX = Math.max(0, Math.min(window.innerWidth, targetX));
                targetY = Math.max(0, Math.min(window.innerHeight, targetY));
            }
            if (auraIdle) {
                auraIdle = false;
                requestAnimationFrame(animateCursor);
            }
        });

        function animateCursor() {
            if (Date.now() - lastMove > 2000) {
                auraIdle = true;
                return;
            }

            // Dot snaps to the pointer exactly.
            cursorDot.style.transform = `translate3d(calc(${targetX}px - 50%), calc(${targetY}px - 50%), 0)`;

            // Aura trails behind smoothly.
            auraX += (targetX - auraX) * AURA_LERP;
            auraY += (targetY - auraY) * AURA_LERP;
            cursorAura.style.transform = `translate3d(calc(${auraX}px - 50%), calc(${auraY}px - 50%), 0)`;

            requestAnimationFrame(animateCursor);
        }
        animateCursor();

        cursorDot.style.opacity = '1';
        cursorAura.style.opacity = '0.9';

        interactiveElements.forEach(el => {
            el.classList.add('interactive-hover-target');
            el.addEventListener('mouseenter', () => {
                cursorAura.classList.add('hovering');
                cursorDot.classList.add('hovering');
            });
            el.addEventListener('mouseleave', () => {
                cursorAura.classList.remove('hovering');
                cursorDot.classList.remove('hovering');
            });
        });

        document.addEventListener('mouseleave', () => {
            cursorDot.style.opacity = '0';
            cursorAura.style.opacity = '0';
        });
        document.addEventListener('mouseenter', () => {
            cursorDot.style.opacity = '1';
            cursorAura.style.opacity = '0.9';
        });
    } else {
        if (cursorAura) cursorAura.style.display = 'none';
        const existingDot = document.getElementById('cursor-dot');
        if (existingDot) existingDot.style.display = 'none';
        document.body.style.removeProperty('cursor');
    }

    // --- Card click ripple ---
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    cards.forEach(card => {
        // Ripple throttle
        let lastClick = 0;
        const clickCooldown = 300; // ms

        card.addEventListener('click', function (e) {
            const now = Date.now();
            if (now - lastClick < clickCooldown) return;
            lastClick = now;

            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });

    });

    // --- Scroll & Resize Listeners ---
    let navTicking = false;
    window.addEventListener('scroll', () => {
        if (!navTicking) {
            requestAnimationFrame(() => {
                updateActiveNavLink();
                navTicking = false;
            });
            navTicking = true;
        }
    }, { passive: true });

    window.addEventListener('resize', () => {
        cacheSectionOffsets();
        updateActiveNavLink();
    });

    updateActiveNavLink();
});

async function fetchJsonWithPolicy(url, policy = {}) {
    if (window.netUtils?.fetchJson) {
        return window.netUtils.fetchJson(url, {}, policy);
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

let gardenStatsInFlight = null;

// --- Dynamic Knowledge Garden Stats from GitHub API ---
async function updateGardenStats() {
    if (gardenStatsInFlight) return gardenStatsInFlight;

    gardenStatsInFlight = (async () => {
        const VAULT_OWNER = 'AIMDaAlien';
        const VAULT_REPO = 'Obsidian-Vault';
        const HIDDEN = ['.obsidian', '.stfolder', '.DS_Store', '.gitignore', 'Myself', 'Business', 'images'];
        const noteCountEl = document.getElementById('noteCount');
        const folderCountEl = document.getElementById('folderCount');
        const projectCountEl = document.getElementById('projectCount');
        const featuredProjectCountEl = document.getElementById('featuredProjectCount');
        const lastUpdatedEl = document.getElementById('gardenLastUpdated');
        const stripNotesEl = document.getElementById('strip-notes');

        const isHiddenPath = (path) => path.split('/').some(part => HIDDEN.includes(part) || part.startsWith('.'));
        const isCandidateFeaturedPath = (path) => (
            path.startsWith('Projects/') ||
            path.startsWith('Systems/Homelab/') ||
            path.startsWith('Systems/Router Configuration/') ||
            path.startsWith('Learning Journals/') ||
            path.startsWith('IT Projects/')
        );
        const setLastUpdatedLabel = (rawDate) => {
            if (!lastUpdatedEl || !rawDate) return;
            const updatedDate = new Date(rawDate);
            if (isNaN(updatedDate.getTime())) return;

            const now = new Date();
            const diffMs = now - updatedDate;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

            if (diffDays === 0) {
                if (diffHours < 1) {
                    lastUpdatedEl.textContent = 'Updated just now';
                } else if (diffHours === 1) {
                    lastUpdatedEl.textContent = 'Updated 1 hour ago';
                } else {
                    lastUpdatedEl.textContent = `Updated ${diffHours} hours ago`;
                }
            } else if (diffDays === 1) {
                lastUpdatedEl.textContent = 'Updated yesterday';
            } else if (diffDays < 7) {
                lastUpdatedEl.textContent = `Updated ${diffDays} days ago`;
            } else if (diffDays < 30) {
                const weeks = Math.floor(diffDays / 7);
                lastUpdatedEl.textContent = weeks === 1 ? 'Updated 1 week ago' : `Updated ${weeks} weeks ago`;
            } else {
                lastUpdatedEl.textContent = `Updated ${updatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            }
        };

        let noteCount = null;
        let folderCount = null;
        let featuredCount = null;

        try {
            const manifest = await fetchJsonWithPolicy(
                `https://raw.githubusercontent.com/${VAULT_OWNER}/${VAULT_REPO}/main/garden-manifest.json?v=${Date.now()}`,
                { timeoutMs: 12000, retries: 2, dedupeKey: `garden-manifest:${VAULT_OWNER}/${VAULT_REPO}` }
            );

            if (manifest && Array.isArray(manifest.tree)) {
                const metadata = manifest.metadata || {};
                const topFolders = new Set();
                let mdCount = 0;

                manifest.tree.forEach(entry => {
                    if (!entry?.path || isHiddenPath(entry.path)) return;

                    if (entry.type === 'file' && entry.path.endsWith('.md')) {
                        mdCount++;
                    }

                    const topFolder = entry.path.includes('/') ? entry.path.split('/')[0] : null;
                    if (topFolder && !topFolder.startsWith('.') && !HIDDEN.includes(topFolder)) {
                        topFolders.add(topFolder);
                    }
                });

                noteCount = mdCount;
                folderCount = topFolders.size;

                featuredCount = Object.entries(metadata).filter(([path, meta]) => {
                    if (!meta || meta.published_to_garden !== true) return false;
                    if (isHiddenPath(path)) return false;
                    return isCandidateFeaturedPath(path);
                }).length;

                if (manifest.generated_at && lastUpdatedEl) {
                    lastUpdatedEl.dataset.updated = manifest.generated_at;
                    setLastUpdatedLabel(manifest.generated_at);
                }
            }
        } catch (error) {
            console.error('Failed to fetch garden manifest:', error);
        }

        if (noteCount === null || folderCount === null) {
            try {
                const data = await fetchJsonWithPolicy(
                    `https://api.github.com/repos/${VAULT_OWNER}/${VAULT_REPO}/git/trees/main?recursive=1`,
                    { timeoutMs: 12000, retries: 2 }
                );
                const tree = data.tree || [];
                const topFolders = new Set();
                let mdCount = 0;

                tree.forEach(item => {
                    if (!item?.path || isHiddenPath(item.path)) return;
                    if (item.type === 'blob' && item.path.endsWith('.md')) mdCount++;

                    const topFolder = item.path.includes('/') ? item.path.split('/')[0] : null;
                    if (topFolder && !topFolder.startsWith('.') && !HIDDEN.includes(topFolder)) {
                        topFolders.add(topFolder);
                    }
                });

                noteCount = mdCount;
                folderCount = topFolders.size;
            } catch (error) {
                console.error('Failed to fetch garden stats:', error);
                noteCount = 50;
                folderCount = 8;
            }
        }

        if (lastUpdatedEl && lastUpdatedEl.dataset.updated) {
            setLastUpdatedLabel(lastUpdatedEl.dataset.updated);
        }

        if (noteCountEl) noteCountEl.textContent = String(noteCount);
        if (folderCountEl) folderCountEl.textContent = String(folderCount);
        if (stripNotesEl) stripNotesEl.textContent = `[garden: ${noteCount}]`;

        if (featuredCount !== null) {
            const clipped = Math.min(featuredCount, 6);
            if (projectCountEl) projectCountEl.textContent = String(clipped);
            if (featuredProjectCountEl) featuredProjectCountEl.textContent = String(clipped);
        }
    })();

    try {
        await gardenStatsInFlight;
    } finally {
        gardenStatsInFlight = null;
    }
}
// Defer garden stats fetch until section is visible
document.addEventListener('DOMContentLoaded', () => {
    const gardenSection = document.getElementById('knowledge-garden-showcase');
    if (!gardenSection) return;
    let statsIntervalId = null;
    const gardenObserver = new IntersectionObserver((entries, obs) => {
        if (entries[0].isIntersecting) {
            updateGardenStats();
            if (!statsIntervalId) {
                statsIntervalId = setInterval(() => {
                    if (!document.hidden) updateGardenStats();
                }, 10 * 60 * 1000);
            }
            obs.disconnect();
        }
    }, { rootMargin: '200px', threshold: 0 });
    gardenObserver.observe(gardenSection);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateGardenStats();
    });
});

// --- Floating Particles ---
function initFloatingParticles() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const container = document.getElementById('particles-container');
    if (!container) return;

    const COUNT = (navigator.hardwareConcurrency || 4) <= 4 ? 20 : 40;
    const sizes = ['sm', 'md', 'lg'];
    const weights = [0.6, 0.3, 0.1]; // probability weights
    const opacities = [0.05, 0.08, 0.12];

    for (let i = 0; i < COUNT; i++) {
        const el = document.createElement('div');

        // Weighted random size
        const r = Math.random();
        const sizeIdx = r < weights[0] ? 0 : r < weights[0] + weights[1] ? 1 : 2;

        el.className = `particle particle--${sizes[sizeIdx]}`;
        el.style.left = `${Math.random() * 100}%`;
        el.style.top = `${Math.random() * 100}%`;
        el.style.setProperty('--p-dur', `${15 + Math.random() * 20}s`);
        el.style.setProperty('--p-drift-x', `${(Math.random() - 0.5) * 100}px`);
        el.style.setProperty('--p-opacity', opacities[sizeIdx]);
        el.style.animationDelay = `-${Math.random() * 35}s`;

        container.appendChild(el);
    }
}
document.addEventListener('DOMContentLoaded', initFloatingParticles);

// --- Matrix Rain Effect (visibility-gated) ---
function initMatrixRain() {
    const canvas = document.getElementById('matrix-rain');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let isVisible = false;
    let rafId = null;

    function resizeCanvas() {
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = canvas.parentElement.offsetHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = new Array(columns).fill(1);

    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#BBC3FF';
        ctx.font = `${fontSize}px monospace`;

        for (let i = 0; i < drops.length; i++) {
            const char = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(char, i * fontSize, drops[i] * fontSize);

            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }

    let lastDraw = 0;
    function animateDraw(timestamp) {
        if (!isVisible) { rafId = null; return; }
        if (timestamp - lastDraw >= 50) {
            draw();
            lastDraw = timestamp;
        }
        rafId = requestAnimationFrame(animateDraw);
    }

    window.matrixRain = {
        start() {
            if (isVisible) return;
            isVisible = true;
            rafId = requestAnimationFrame(animateDraw);
        },
        stop() {
            isVisible = false;
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        }
    };
}

// --- Section Visibility Observer ---
function initSectionVisibilityObserver() {
    const sections = document.querySelectorAll('#hero, #experience, #projects, footer');
    if (!sections.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const el = entry.target;
            if (entry.isIntersecting) {
                el.classList.add('section-visible');
                if (el.tagName === 'FOOTER' && window.matrixRain) window.matrixRain.start();
            } else {
                el.classList.remove('section-visible');
                if (el.tagName === 'FOOTER' && window.matrixRain) window.matrixRain.stop();
            }
        });
    }, { rootMargin: '50px', threshold: 0 });

    sections.forEach(s => observer.observe(s));
}

// --- Uptime Counter ---
function initUptimeCounter() {
    const uptimeEl = document.getElementById('uptime-value');
    if (!uptimeEl) return;

    // Portfolio "launch date" - adjust as needed
    const launchDate = new Date('2024-01-01T00:00:00');

    function updateUptime() {
        const now = new Date();
        const diff = now - launchDate;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        uptimeEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;

        const stripUptime = document.getElementById('strip-uptime');
        if (stripUptime) stripUptime.textContent = `[uptime: ${days}d ${hours}h]`;
    }

    updateUptime();
    setInterval(updateUptime, 1000);
}

// --- VU Meter Gauges (skill cards) ---
function initVuMeters() {
    const meters = document.querySelectorAll('.vu-meter');
    if (!meters.length) return;

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const meter = entry.target;
            const level = parseFloat(meter.dataset.level) || 0;
            const clamped = Math.max(0, Math.min(1, level));
            const deg = -50 + clamped * 100;
            meter.style.setProperty('--vu-angle', `${deg}deg`);
            meter.classList.add('vu-live');
            obs.unobserve(meter);
        });
    }, { threshold: 0.1 });

    meters.forEach(meter => observer.observe(meter));
}

// --- Unraid Telemetry ---
function initUnraidTelemetry() {
    const container = document.getElementById('unraidTelemetry');
    if (!container) return;

    const endpoint = container.dataset.endpoint.trim();
    const pollInterval = Math.max(10000, Number.parseInt(container.dataset.interval, 10) || 30000);
    const staleAfter = Math.max(90000, pollInterval * 1.5);
    const offlineAfter = Math.max(300000, pollInterval * 3);
    const dot = document.getElementById('telemetryDot');
    const updated = document.getElementById('telemetryUpdated');
    let pollId = null;
    let requestInFlight = false;
    let lastPayloadTime = 0;

    const setStatus = (state, label) => {
        if (dot) {
            dot.classList.remove(
                'telemetry-status-dot--pending',
                'telemetry-status-dot--stale',
                'telemetry-status-dot--offline'
            );
            if (state !== 'online') dot.classList.add(`telemetry-status-dot--${state}`);
        }
        if (updated) updated.textContent = label;
    };

    const formatAge = (timestamp) => {
        const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        return `${Math.floor(minutes / 60)}h ago`;
    };

    const refreshFreshness = () => {
        if (!lastPayloadTime) {
            setStatus('offline', 'signal unavailable');
            return;
        }

        const age = Date.now() - lastPayloadTime;
        if (age > offlineAfter) setStatus('offline', `offline · ${formatAge(lastPayloadTime)}`);
        else if (age > staleAfter) setStatus('stale', `stale · ${formatAge(lastPayloadTime)}`);
        else setStatus('online', `updated ${formatAge(lastPayloadTime)}`);
    };

    const finiteNumber = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    };

    const updateGauge = (barId, valueId, percentage, valueLabel, warningAt) => {
        const bar = document.getElementById(barId);
        const value = document.getElementById(valueId);
        if (!bar || !value || percentage === null) return;

        const level = Math.max(0, Math.min(100, percentage));
        bar.style.setProperty('--telemetry-level', `${level}%`);
        bar.setAttribute('aria-valuenow', String(Math.round(level)));
        bar.setAttribute('aria-valuetext', valueLabel);
        bar.classList.toggle('is-warning', level >= warningAt && level < 95);
        bar.classList.toggle('is-critical', level >= 95);
        value.textContent = valueLabel;
    };

    const updateText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    const renderTelemetry = (payload) => {
        const cpu = finiteNumber(payload.cpu_pct);
        const ramUsed = finiteNumber(payload.ram_used_gb);
        const ramTotal = finiteNumber(payload.ram_total_gb);
        const arrayUsed = finiteNumber(payload.array_used_tb);
        const arrayTotal = finiteNumber(payload.array_total_tb);
        const uptimeDays = finiteNumber(payload.uptime_days);
        const temperature = finiteNumber(payload.temp_c);
        const dockerCount = finiteNumber(payload.docker_ct);

        updateGauge('gaugeCpu', 'cpuValue', cpu, cpu === null ? '--' : `${cpu.toFixed(1)}%`, 80);
        updateGauge(
            'gaugeRam',
            'ramValue',
            ramUsed !== null && ramTotal > 0 ? (ramUsed / ramTotal) * 100 : null,
            ramUsed !== null && ramTotal > 0 ? `${ramUsed.toFixed(1)}/${ramTotal.toFixed(0)} GB` : '--',
            80
        );
        updateGauge(
            'gaugeArray',
            'arrayValue',
            arrayUsed !== null && arrayTotal > 0 ? (arrayUsed / arrayTotal) * 100 : null,
            arrayUsed !== null && arrayTotal > 0 ? `${arrayUsed.toFixed(1)}/${arrayTotal.toFixed(1)} TB` : '--',
            85
        );

        updateText('dockerCt', dockerCount === null ? '--' : String(Math.max(0, Math.round(dockerCount))));
        updateText('unraidUptime', uptimeDays === null ? '--' : `${Math.max(0, Math.floor(uptimeDays))}d`);
        updateText('tempValue', temperature === null ? '--' : `${temperature.toFixed(0)}°C`);

        const payloadDate = new Date(payload.ts);
        lastPayloadTime = Number.isNaN(payloadDate.getTime()) ? Date.now() : payloadDate.getTime();
        refreshFreshness();
    };

    const fetchTelemetry = async () => {
        if (requestInFlight) return;
        requestInFlight = true;
        try {
            const payload = await fetchJsonWithPolicy(endpoint, {
                timeoutMs: 8000,
                retries: 0,
                dedupeKey: `unraid-telemetry:${endpoint}`
            });
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                throw new Error('Invalid telemetry payload');
            }
            renderTelemetry(payload);
        } catch (_error) {
            refreshFreshness();
        } finally {
            requestInFlight = false;
        }
    };

    const stopPolling = () => {
        if (pollId !== null) clearInterval(pollId);
        pollId = null;
    };

    const startPolling = () => {
        if (pollId !== null) return;
        fetchTelemetry();
        pollId = setInterval(fetchTelemetry, pollInterval);
    };

    if (!endpoint) {
        setStatus('pending', 'endpoint pending');
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) startPolling();
            else stopPolling();
        });
    }, { threshold: 0.1 });

    observer.observe(container);
}

// --- Relative date label ("2d ago", "3w ago") in the style of setLastUpdatedLabel ---
function relativeDateLabel(rawDate) {
    const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
    if (isNaN(date.getTime())) return '';

    // Clamp at 0: manifest timestamps carry no timezone, so a just-published
    // note can look slightly "future" depending on the viewer's clock.
    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffDays === 0) {
        if (diffHours < 1) return 'just now';
        return `${diffHours}h ago`;
    }
    if (diffDays === 1) return '1d ago';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks}w ago`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Vault Activity: recent notes widget, footer ticker, incident sign (one shared fetch) ---
async function initVaultActivity() {
    const VAULT_OWNER = 'AIMDaAlien';
    const VAULT_REPO = 'Obsidian-Vault';
    const listEl = document.getElementById('recentNotesList');
    const tickerEl = document.getElementById('vaultTicker');
    const tickerTrackEl = document.getElementById('vaultTickerTrack');
    const incidentDaysEl = document.getElementById('incidentDays');
    const incidentDateEl = document.getElementById('incidentDate');
    const incidentSummaryEl = document.getElementById('incidentSummary');
    const incidentNextEl = document.getElementById('incidentNext');

    let manifest = null;
    try {
        manifest = await fetchJsonWithPolicy(
            `https://raw.githubusercontent.com/${VAULT_OWNER}/${VAULT_REPO}/main/garden-manifest.json?v=${Date.now()}`,
            { timeoutMs: 12000, retries: 2, dedupeKey: `garden-manifest:${VAULT_OWNER}/${VAULT_REPO}` }
        );
    } catch (error) {
        console.error('Failed to fetch vault activity manifest:', error);
    }

    const metadata = (manifest && manifest.metadata) || {};

    const recent = Object.entries(metadata)
        .map(([path, meta]) => ({
            path,
            meta,
            date: new Date(meta && (meta.last_published || meta.updated || meta.created) || '')
        }))
        .filter(item => item.meta && !isNaN(item.date.getTime()))
        .sort((a, b) => b.date - a.date);

    const noteTitle = ({ path, meta }) =>
        meta.title || path.split('/').pop().replace(/\.md$/, '');

    // Feature: "Latest transmissions" recent-notes widget
    if (listEl) {
        if (!recent.length) {
            listEl.innerHTML = '<li class="recent-notes-empty">signal unavailable &mdash; check the garden directly</li>';
        } else {
            listEl.innerHTML = '';
            recent.slice(0, 5).forEach(item => {
                const li = document.createElement('li');
                const link = document.createElement('a');
                link.href = 'garden-terminal.html';

                const titleSpan = document.createElement('span');
                titleSpan.className = 'recent-notes-title';
                titleSpan.textContent = noteTitle(item);

                const dateSpan = document.createElement('span');
                dateSpan.className = 'recent-notes-date';
                dateSpan.textContent = relativeDateLabel(item.date);

                link.append(titleSpan, dateSpan);
                li.appendChild(link);
                listEl.appendChild(li);
            });
        }
    }

    // Feature: vault activity ticker in the footer
    if (tickerEl && tickerTrackEl && recent.length) {
        const items = recent.slice(0, 8).map(item =>
            `\u25B8 vault update: ${noteTitle(item)} \u2014 ${relativeDateLabel(item.date)}`
        );
        const sequence = items.join('\u2003\u2003\u00B7\u2003\u2003') + '\u2003\u2003\u00B7\u2003\u2003';
        // Render the sequence twice so translateX(-50%) loops seamlessly.
        tickerTrackEl.textContent = sequence + sequence;
        tickerEl.hidden = false;
    }

    // Feature: incident sign ("days since last homelab incident")
    const incidentEntry = Object.values(metadata)
        .filter(meta => meta && meta.last_incident)
        .sort((a, b) => new Date(b.last_published || 0) - new Date(a.last_published || 0))[0];
    const incidentDate = new Date(incidentEntry ? incidentEntry.last_incident : '2026-06-27');
    if (!isNaN(incidentDate.getTime())) {
        const days = Math.max(0, Math.floor((Date.now() - incidentDate.getTime()) / (1000 * 60 * 60 * 24)));
        if (incidentDaysEl) incidentDaysEl.textContent = String(days);
        if (incidentDateEl) {
            // Date-only values parse as UTC midnight; format in UTC so the
            // label shows the intended calendar date in any timezone.
            incidentDateEl.textContent = `last reset: ${incidentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
        }
    }
    if (incidentSummaryEl && incidentEntry?.incident_summary) {
        incidentSummaryEl.textContent = incidentEntry.incident_summary;
    }
    if (incidentNextEl && incidentEntry?.next_maintenance) {
        incidentNextEl.textContent = incidentEntry.next_maintenance;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initMatrixRain();
    initUptimeCounter();
    initVuMeters();
    initUnraidTelemetry();
    initVaultActivity();
});
