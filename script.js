document.addEventListener('DOMContentLoaded', () => {
    // --- Cached DOM Elements ---
    const loader = document.getElementById('loader');
    const startupIntro = document.getElementById('startup-intro');
    const startupQuote = document.getElementById('startup-quote');
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
    const interactiveElements = Array.from(document.querySelectorAll(
        'a, button, .stat-card, .skill-category, .project-card, .timeline-item, .section-title, .nav-link, .hamburger-menu'
    ));
    const cards = Array.from(document.querySelectorAll('.stat-card, .skill-category, .project-card'));

    // --- Loading and Startup Sequence ---
    function startWebsite() {
        loader.style.transition = 'opacity 0.5s ease-out';
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);

        if (startupSound) {
            startupSound.volume = 0.3;
            startupSound.loop = true;
            const playSoundPromise = startupSound.play();
            if (playSoundPromise !== undefined) {
                playSoundPromise.catch(error => {
                    console.warn("Startup sound autoplay was prevented:", error);
                });
            }
        }

        startupIntro.style.opacity = '1';
        setTimeout(() => {
            startupQuote.style.opacity = '1';
            startupQuote.style.transform = 'scale(1.6)';
        }, 100);

        setTimeout(() => {
            startupQuote.style.transform = 'scale(0.6)';
            startupQuote.style.opacity = '0';
        }, 2500);

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
        }, 4000);
    }

    setTimeout(startWebsite, 200);

    // --- Navigation Scroll Active State & Sticky Nav ---
    function updateActiveNavLink() {
        let currentSectionId = '';
        pageSections.forEach(section => {
            const sectionTop = section.offsetTop - mainNav.offsetHeight - 50;
            if (window.scrollY >= sectionTop) {
                currentSectionId = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });

        if (window.scrollY > 50) {
            mainNav.classList.add('scrolled');
        } else {
            mainNav.classList.remove('scrolled');
        }
    }

    // --- Hamburger Menu Toggle ---
    if (hamburgerMenu && mobileNavUl) {
        hamburgerMenu.addEventListener('click', () => {
            hamburgerMenu.classList.toggle('active');
            mobileNavUl.classList.toggle('active');
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

    // --- Scroll-Triggered Animations ---
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
            const rect = el.getBoundingClientRect();
            if (rect.top <= (window.innerHeight || document.documentElement.clientHeight) && rect.bottom >= 0 && !el.classList.contains('is-visible')) {
                const siblings = Array.from(el.parentElement.children);
                const delay = el.classList.contains('stagger') ? (siblings.indexOf(el) * 150) : 0;
                setTimeout(() => {
                    el.classList.add('is-visible');
                }, delay);
                scrollObserver.unobserve(el);
            } else if (!el.classList.contains('is-visible')) {
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
    // --- Optimized Cursor Aura with Animation Frame ---
    if (cursorAura) {
        // Make the inner circle a lighter color for better visibility
        cursorAura.style.background = 'rgba(255,255,255,0.7)';
        cursorAura.style.boxShadow = '0 0 16px 4px rgba(255,255,255,0.5)';

        // Hide the default mouse cursor
        document.body.style.cursor = 'none';

        let auraX = window.innerWidth / 2;
        let auraY = window.innerHeight / 2;
        let targetX = auraX;
        let targetY = auraY;
        let pointerLocked = false;

        // Update targetX/Y on mousemove (normal)
        document.addEventListener('mousemove', (e) => {
            if (!pointerLocked) {
                targetX = e.clientX;
                targetY = e.clientY;
            } else {
                // Pointer lock movement
                targetX += e.movementX;
                targetY += e.movementY;
                targetX = Math.max(0, Math.min(window.innerWidth, targetX));
                targetY = Math.max(0, Math.min(window.innerHeight, targetY));
            }
        });

        // Animation loop for aura
        function animateAura() {
            auraX += (targetX - auraX) * 0.25;
            auraY += (targetY - auraY) * 0.25;
            cursorAura.style.transform = `translate3d(${auraX}px, ${auraY}px, 0)`;
            requestAnimationFrame(animateAura);
        }
        animateAura();

        // Set initial opacity to 0.9 (90%)
        cursorAura.style.opacity = '0.9';

        interactiveElements.forEach(el => {
            el.classList.add('interactive-hover-target');
            el.addEventListener('mouseenter', () => {
                cursorAura.classList.add('hovering');
            });
            el.addEventListener('mouseleave', () => {
                cursorAura.classList.remove('hovering');
            });
        });

        document.addEventListener('mouseleave', () => {
            cursorAura.style.opacity = '0';
        });
        document.addEventListener('mouseenter', () => {
            cursorAura.style.opacity = '0.9';
        });

        // Optional: pointer lock logic can be added here if needed
    }

    // --- Enhanced Card Interactions (Ripple and Tilt) ---
    cards.forEach(card => {
        card.addEventListener('click', function(e) {
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
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });

        card.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;
            this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px) scale(1.03)`;
        });

        card.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
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

    // --- Event Listeners ---
    window.addEventListener('scroll', () => {
        updateActiveNavLink();
        if (window.scrollY < window.innerHeight) {
            requestTick();
        }
    }, { passive: true });

    window.addEventListener('resize', () => {
        updateActiveNavLink();
    });

    updateActiveNavLink();
    if (window.scrollY > 0 && window.scrollY < window.innerHeight) {
        requestTick();
    }
});
