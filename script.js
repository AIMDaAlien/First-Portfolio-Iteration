document.addEventListener('DOMContentLoaded', () => {
    // === Device & Performance Detection ===
    const isLowEndDevice = /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                          navigator.hardwareConcurrency <= 2 ||
                          navigator.deviceMemory <= 2;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const disableHeavyAnimations = isLowEndDevice || prefersReducedMotion;

    // === Cached DOM Elements ===
    const loader = document.getElementById('loader');
    const startupIntro = document.getElementById('startup-intro');
    const startupQuote = document.getElementById('startup-quote');
    const startupQuoter = document.getElementById('startup-quoter');
    const startupSound = document.getElementById('startup-sound');
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

    // === OPTIMIZED STARTUP SEQUENCE (50% faster) ===
    const TIMING = {
        loaderFade: 250,        // Was 500ms
        quoteShow: 50,          // Was 100ms
        quoteDuration: 2500,    // Was 5000ms
        quoteFade: 250,         // Same
        contentDelay: 350,      // Was 700ms
        totalDuration: 3250     // Was 6500ms (50% reduction)
    };

    let audioStarted = false;
    
    function attemptAudioPlay() {
        if (!audioStarted && startupSound && !disableHeavyAnimations) {
            startupSound.volume = 0.3;
            startupSound.loop = true;
            
            const playPromise = startupSound.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    audioStarted = true;
                }).catch(() => {
                    // Fail silently, audio is optional
                    const enableAudio = () => {
                        if (!audioStarted) {
                            startupSound.play().then(() => audioStarted = true).catch(() => {});
                            document.removeEventListener('click', enableAudio);
                            document.removeEventListener('keydown', enableAudio);
                        }
                    };
                    document.addEventListener('click', enableAudio, { once: true });
                    document.addEventListener('keydown', enableAudio, { once: true });
                });
            }
        }
    }

    // === Section Offsets for Scroll Tracking ===
    let sectionOffsets = [];
    function cacheSectionOffsets() {
        sectionOffsets = pageSections.map(section => ({
            id: section.id,
            offsetTop: section.offsetTop - (mainNav?.offsetHeight || 64) - 50
        }));
    }
    
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(cacheSectionOffsets, 150);
    });
    cacheSectionOffsets();

    // === OPTIMIZED Loading and Startup Sequence ===
    function startWebsite() {
        loader.style.transition = `opacity ${TIMING.loaderFade}ms ease-out`;
        loader.style.opacity = '0';
        setTimeout(() => { 
            loader.style.display = 'none'; 
        }, TIMING.loaderFade);

        attemptAudioPlay();

        startupIntro.style.opacity = '1';
        setTimeout(() => {
            startupQuote.style.opacity = '1';
            startupQuote.style.transform = 'scale(1.6)';
            if (startupQuoter) {
                startupQuoter.style.opacity = '1';
                startupQuoter.style.transform = 'translateY(0)';
            }
        }, TIMING.quoteShow);

        setTimeout(() => {
            startupQuote.style.transform = 'scale(0.6)';
            startupQuote.style.opacity = '0';
            if (startupQuoter) {
                startupQuoter.style.opacity = '0';
            }
        }, TIMING.quoteDuration);

        setTimeout(() => {
            startupIntro.style.opacity = '0';
            mainContent.style.display = 'block';

            setTimeout(() => {
                startupIntro.style.display = 'none';
                mainNav?.classList.add('visible');

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
            }, TIMING.contentDelay);
        }, TIMING.quoteDuration + TIMING.quoteFade);
    }

    setTimeout(startWebsite, 100);

    // === OPTIMIZED Navigation Scroll Active State ===
    let lastScrollPosition = 0;
    function updateActiveNavLink() {
        const scrollY = window.scrollY;
        
        // Only update if scroll position changed significantly
        if (Math.abs(scrollY - lastScrollPosition) < 10) return;
        lastScrollPosition = scrollY;
        
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

        mainNav?.classList.toggle('scrolled', scrollY > 50);
    }

    // === Hamburger Menu Toggle ===
    if (hamburgerMenu && mobileNavUl) {
        hamburgerMenu.addEventListener('click', () => {
            const isExpanded = hamburgerMenu.getAttribute('aria-expanded') === 'true';
            hamburgerMenu.setAttribute('aria-expanded', !isExpanded);
            hamburgerMenu.classList.toggle('active');
            mobileNavUl.classList.toggle('active');
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (hamburgerMenu?.classList.contains('active')) {
                hamburgerMenu.classList.remove('active');
                hamburgerMenu.setAttribute('aria-expanded', 'false');
                mobileNavUl?.classList.remove('active');
            }
        });
    });

    // === OPTIMIZED Scroll-Triggered Animations ===
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
                
                if (disableHeavyAnimations) {
                    el.classList.add('is-visible');
                } else {
                    setTimeout(() => el.classList.add('is-visible'), delay);
                }
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

    // === Smooth Scrolling for Nav Links ===
    navLinks.forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('#') && href.length > 1) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    const navHeight = mainNav?.offsetHeight || 0;
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

    // === CONDITIONAL Cursor Aura (Disabled on low-end devices & reduced motion) ===
    if (cursorAura && !disableHeavyAnimations) {
        cursorAura.style.background = 'rgba(255,255,255,0.7)';
        cursorAura.style.boxShadow = '0 0 16px 4px rgba(255,255,255,0.5)';
        document.body.style.cursor = 'none';

        let auraX = window.innerWidth / 2;
        let auraY = window.innerHeight / 2;
        let targetX = auraX;
        let targetY = auraY;

        document.addEventListener('mousemove', (e) => {
            targetX = e.clientX;
            targetY = e.clientY;
        }, { passive: true });

        function animateAura() {
            auraX += (targetX - auraX) * 0.25;
            auraY += (targetY - auraY) * 0.25;
            cursorAura.style.transform = `translate3d(${auraX}px, ${auraY}px, 0)`;
            requestAnimationFrame(animateAura);
        }
        animateAura();

        cursorAura.style.opacity = '0.9';

        document.addEventListener('mouseleave', () => {
            cursorAura.style.opacity = '0';
        }, { passive: true });
        document.addEventListener('mouseenter', () => {
            cursorAura.style.opacity = '0.9';
        }, { passive: true });
    } else if (cursorAura) {
        // Remove cursor aura entirely on low-end devices
        cursorAura.remove();
    }

    // === OPTIMIZED Parallax effect for hero section ===
    if (!disableHeavyAnimations) {
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

        // === THROTTLED Scroll & Resize Listeners ===
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            updateActiveNavLink();
            if (window.scrollY < window.innerHeight) {
                requestTick();
            }
        }, { passive: true });
    } else {
        // Just update nav on scroll for low-end devices
        window.addEventListener('scroll', updateActiveNavLink, { passive: true });
    }

    window.addEventListener('resize', () => {
        cacheSectionOffsets();
        updateActiveNavLink();
    }, { passive: true });

    updateActiveNavLink();
});

// === OPTIMIZED Preload Images ===
function preloadImages() {
    const images = document.querySelectorAll('img[data-src]');
    if (images.length === 0) return;
    
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
