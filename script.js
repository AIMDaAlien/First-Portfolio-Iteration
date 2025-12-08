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
        loader.style.transition = 'opacity 0.5s ease-out';
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 500);


        startupIntro.style.opacity = '1';
        setTimeout(() => {
            startupQuote.style.opacity = '1';
            startupQuote.style.transform = 'scale(1.6)';
            if (startupQuoter) {
                startupQuoter.style.opacity = '1';
                startupQuoter.style.transform = 'translateY(0)';
            }
        }, 100);

        setTimeout(() => {
            startupQuote.style.transform = 'scale(0.6)';
            startupQuote.style.opacity = '0';
            if (startupQuoter) {
                startupQuoter.style.opacity = '0';
            }
        }, 5000);  // Extended from 2500ms

        setTimeout(() => {
            startupIntro.style.opacity = '0';
            mainContent.style.display = 'block';

            setTimeout(() => {
                startupIntro.style.display = 'none';
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
                }
                if (scrollIndicator) {
                    scrollIndicator.style.opacity = '1';
                }

                checkElementsVisibility();
            }, 700);
        }, 6500);  // Extended from 4000ms to give users time to interact
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
        cursorAura.style.background = 'rgba(255,255,255,0.7)';
        cursorAura.style.boxShadow = '0 0 16px 4px rgba(255,255,255,0.5)';
        document.body.style.cursor = 'none';

        let auraX = window.innerWidth / 2;
        let auraY = window.innerHeight / 2;
        let targetX = auraX;
        let targetY = auraY;
        let pointerLocked = false;

        document.addEventListener('mousemove', (e) => {
            if (!pointerLocked) {
                targetX = e.clientX;
                targetY = e.clientY;
            } else {
                targetX += e.movementX;
                targetY += e.movementY;
                targetX = Math.max(0, Math.min(window.innerWidth, targetX));
                targetY = Math.max(0, Math.min(window.innerHeight, targetY));
            }
        });

        function animateAura() {
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
    window.addEventListener('scroll', () => {
        updateActiveNavLink();
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

// --- Preload Images ---
function preloadImages() {
    const images = document.querySelectorAll('img[data-src]');
    images.forEach(img => {
        const src = img.getAttribute('data-src');
        if (src) {
            const newImg = new Image();
            newImg.src = src;
            newImg.onload = () => {
                img.src = src;
                img.removeAttribute('data-src');
            };
        }
    });
}
document.addEventListener('DOMContentLoaded', preloadImages);

// --- Dynamic Knowledge Garden Stats ---
function updateGardenStats() {
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
            // Show the actual date for older updates
            relativeText = `Updated ${updatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }

        lastUpdatedEl.textContent = relativeText;
    }

    // Update note count with + suffix if over threshold
    const noteCountEl = document.getElementById('technicalNotesCount');
    if (noteCountEl && noteCountEl.dataset.count) {
        const count = parseInt(noteCountEl.dataset.count, 10);
        noteCountEl.textContent = count >= 10 ? `${count}+` : count.toString();
    }
}
document.addEventListener('DOMContentLoaded', updateGardenStats);