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
    const heroParallaxElements = Array.from(document.querySelectorAll('#hero .hero-title, #hero .hero-subtitle'));
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
                            typeSubtitle('Aspiring IT Professional • Systems Optimization');
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

    // --- Optimized Cursor Aura ---
    if (cursorAura) {
        cursorAura.style.background = 'rgba(187,195,255,0.7)';
        cursorAura.style.boxShadow = '0 0 16px 4px rgba(187,195,255,0.5)';
        document.body.style.cursor = 'none';

        let auraX = window.innerWidth / 2;
        let auraY = window.innerHeight / 2;
        let targetX = auraX;
        let targetY = auraY;
        let pointerLocked = false;
        let auraIdle = false;
        let lastMove = Date.now();

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
                requestAnimationFrame(animateAura);
            }
        });

        function animateAura() {
            if (Date.now() - lastMove > 2000) {
                auraIdle = true;
                return;
            }
            auraX += (targetX - auraX) * 0.25;
            auraY += (targetY - auraY) * 0.25;
            cursorAura.style.transform = `translate3d(${auraX}px, ${auraY}px, 0)`;
            requestAnimationFrame(animateAura);
        }
        animateAura();

        cursorAura.style.opacity = '0.9';

        interactiveElements.forEach(el => {
            el.classList.add('interactive-hover-target');
            el.addEventListener('mouseenter', () => cursorAura.classList.add('hovering'));
            el.addEventListener('mouseleave', () => cursorAura.classList.remove('hovering'));
        });

        document.addEventListener('mouseleave', () => {
            cursorAura.style.opacity = '0';
        });
        document.addEventListener('mouseenter', () => {
            cursorAura.style.opacity = '0.9';
        });
    }

    // --- Throttled Card Interactions (Ripple + Tilt) ---
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

        // Tilt effect - only if user doesn't prefer reduced motion
        if (!prefersReducedMotion) {
            let tiltX = 0;
            let tiltY = 0;
            let rafId = null;

            function updateTiltTransform() {
                card.style.transform = `perspective(1000px) rotateX(${tiltY}deg) rotateY(${tiltX}deg) translateY(-5px) scale(1.03)`;
                rafId = null;
            }

            card.addEventListener('mousemove', function (e) {
                const rect = this.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                tiltX = (centerX - x) / 20;
                tiltY = (y - centerY) / 20;

                if (!rafId) {
                    rafId = requestAnimationFrame(updateTiltTransform);
                }
            });

            card.addEventListener('mouseleave', function () {
                this.style.transform = '';
                cancelAnimationFrame(rafId);
                rafId = null;
            });
        }
    });

    // --- Parallax effect for hero section ---
    let ticking = false;
    function updateParallax() {
        const scrolled = window.scrollY;
        heroParallaxElements.forEach((el, index) => {
            const speed = Math.min(0.5, 0.3 + (index * 0.05));
            el.style.transform = `translateY(${scrolled * speed}px)`;
        });
        ticking = false;
    }

    function requestTick() {
        if (!ticking) {
            window.requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }

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
        if (window.scrollY < window.innerHeight) {
            requestTick();
        }
    }, { passive: true });

    window.addEventListener('resize', () => {
        cacheSectionOffsets();
        updateActiveNavLink();
    });

    updateActiveNavLink();
    if (window.scrollY > 0 && window.scrollY < window.innerHeight) {
        requestTick();
    }
});

// --- Dynamic Knowledge Garden Stats from GitHub API ---
async function updateGardenStats() {
    const VAULT_OWNER = 'AIMDaAlien';
    const VAULT_REPO = 'Obsidian-Vault';
    const HIDDEN = ['.obsidian', '.stfolder', '.DS_Store', '.gitignore', 'Myself', 'Business', 'images'];

    // Update "Last Updated" with relative date
    const lastUpdatedEl = document.getElementById('gardenLastUpdated');
    if (lastUpdatedEl && lastUpdatedEl.dataset.updated) {
        const updatedDate = new Date(lastUpdatedEl.dataset.updated);
        const now = new Date();
        const diffMs = now - updatedDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

        let relativeText;
        if (diffDays === 0) {
            if (diffHours < 1) {
                relativeText = 'Updated just now';
            } else if (diffHours === 1) {
                relativeText = 'Updated 1 hour ago';
            } else {
                relativeText = `Updated ${diffHours} hours ago`;
            }
        } else if (diffDays === 1) {
            relativeText = 'Updated yesterday';
        } else if (diffDays < 7) {
            relativeText = `Updated ${diffDays} days ago`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            relativeText = weeks === 1 ? 'Updated 1 week ago' : `Updated ${weeks} weeks ago`;
        } else {
            relativeText = `Updated ${updatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
        lastUpdatedEl.textContent = relativeText;
    }

    // Fetch stats from GitHub API
    try {
        const response = await fetch(`https://api.github.com/repos/${VAULT_OWNER}/${VAULT_REPO}/git/trees/main?recursive=1`);
        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        const tree = data.tree || [];

        // Count .md files (excluding hidden folders)
        let noteCount = 0;
        const topFolders = new Set();

        tree.forEach(item => {
            const pathParts = item.path.split('/');
            const isHidden = pathParts.some(part => HIDDEN.includes(part) || part.startsWith('.'));

            if (!isHidden) {
                if (item.type === 'blob' && item.path.endsWith('.md')) {
                    noteCount++;
                }
                // Count top-level folders
                if (item.type === 'tree' && !item.path.includes('/')) {
                    topFolders.add(item.path);
                }
            }
        });

        // Update DOM
        const noteCountEl = document.getElementById('noteCount');
        if (noteCountEl) noteCountEl.textContent = noteCount + '+';

        const folderCountEl = document.getElementById('folderCount');
        if (folderCountEl) folderCountEl.textContent = topFolders.size;

    } catch (error) {
        console.error('Failed to fetch garden stats:', error);
        // Show fallback values
        const noteCountEl = document.getElementById('noteCount');
        if (noteCountEl) noteCountEl.textContent = '50+';
        const folderCountEl = document.getElementById('folderCount');
        if (folderCountEl) folderCountEl.textContent = '8';
    }
}
// Defer garden stats fetch until section is visible
document.addEventListener('DOMContentLoaded', () => {
    const gardenSection = document.getElementById('knowledge-garden-showcase');
    if (!gardenSection) return;
    const gardenObserver = new IntersectionObserver((entries, obs) => {
        if (entries[0].isIntersecting) {
            updateGardenStats();
            obs.disconnect();
        }
    }, { rootMargin: '200px', threshold: 0 });
    gardenObserver.observe(gardenSection);
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
    }

    updateUptime();
    setInterval(updateUptime, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    initMatrixRain();
    initUptimeCounter();
});