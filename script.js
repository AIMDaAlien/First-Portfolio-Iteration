document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const startupIntro = document.getElementById('startup-intro');
    const startupQuote = document.getElementById('startup-quote');
    const startupSound = document.getElementById('startup-sound');
    const mainContent = document.getElementById('main-content');
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    const mainNav = document.getElementById('main-nav');
    const navLinks = document.querySelectorAll('.nav-link');
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const mobileNavUl = document.querySelector('#main-nav ul');
    const cursorAura = document.getElementById('cursor-aura');

    // --- Set Current Year in Footer ---
    const currentYearSpan = document.getElementById('current-year');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    // --- Loading and Startup Sequence ---
    function startWebsite() {
        // 1. Hide Loader
        loader.style.transition = 'opacity 0.5s ease-out';
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);

        // 2. Play Startup Sound (if user interaction has occurred or autoplay is allowed)
        const playSoundPromise = startupSound.play();
        if (playSoundPromise !== undefined) {
            playSoundPromise.catch(error => {
                console.warn("Startup sound autoplay was prevented:", error);
            });
        }

        // 3. Startup Visual Intro
        startupIntro.style.opacity = '1';
        setTimeout(() => {
            startupQuote.style.opacity = '1';
            startupQuote.style.transform = 'scale(1.6)'; // Start large
        }, 100);

        setTimeout(() => {
            startupQuote.style.transform = 'scale(0.6)'; // Become smaller
            startupQuote.style.opacity = '0'; // Fade out
        }, 2500);

        // 4. Transition to Main Content
        setTimeout(() => {
            startupIntro.style.opacity = '0';
            mainContent.style.display = 'block';

            setTimeout(() => {
                startupIntro.style.display = 'none';
                
                // Animate navbar entrance
                mainNav.classList.add('visible');
                
                // Split hero title into characters for animation
                const heroText = heroTitle.textContent;
                heroTitle.innerHTML = heroText.split('').map((char, i) => 
                    `<span style="transition-delay: ${i * 50}ms">${char}</span>`
                ).join('');
                
                // Animate hero elements
                heroTitle.style.opacity = '1';
                heroTitle.style.transform = 'translateY(0) scale(1)';
                heroTitle.classList.add('visible');
                
                heroSubtitle.style.opacity = '1';
                heroSubtitle.style.transform = 'translateY(0) scale(1)';
                
                scrollIndicator.style.opacity = '1';
                
                checkElementsVisibility();
            }, 700);
        }, 4000);
    }

    // Start after a brief moment to ensure assets are ready
    setTimeout(startWebsite, 200);

    // --- Navigation Scroll Active State & Sticky Nav ---
    function updateActiveNavLink() {
        let currentSection = '';
        const sections = document.querySelectorAll('section[id]');
        sections.forEach(section => {
            const sectionTop = section.offsetTop - mainNav.offsetHeight - 50;
            if (window.scrollY >= sectionTop) {
                currentSection = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });

        // Sticky Nav Background
        if (window.scrollY > 50) {
            mainNav.classList.add('scrolled');
        } else {
            mainNav.classList.remove('scrolled');
        }
    }

    // --- Hamburger Menu Toggle ---
    hamburgerMenu.addEventListener('click', () => {
        hamburgerMenu.classList.toggle('active');
        mobileNavUl.classList.toggle('active');
    });

    // Close mobile menu when a link is clicked
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (hamburgerMenu.classList.contains('active')) {
                hamburgerMenu.classList.remove('active');
                mobileNavUl.classList.remove('active');
            }
        });
    });

    // --- Scroll-Triggered Animations ---
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    function handleIntersect(entries, observer) {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const delay = el.classList.contains('stagger') ? index * 150 : 0;
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
            if (rect.top <= (window.innerHeight || document.documentElement.clientHeight) && rect.bottom >= 0) {
                const delay = el.classList.contains('stagger') ? Array.from(animatedElements).indexOf(el) * 150 : 0;
                setTimeout(() => {
                    el.classList.add('is-visible');
                }, delay);
            } else {
                scrollObserver.observe(el);
            }
        });
    }

    animatedElements.forEach(el => scrollObserver.observe(el));

    // --- Smooth Scrolling for Nav Links ---
    navLinks.forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href.startsWith('#') && href.length > 1) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    const navHeight = mainNav.offsetHeight;
                    const elementPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
                    const offsetPosition = elementPosition - navHeight - (parseInt(getComputedStyle(targetElement).marginTop) || 0);

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // --- Cursor Aura ---
    if (cursorAura) {
        document.addEventListener('mousemove', (e) => {
            cursorAura.style.left = `${e.clientX}px`;
            cursorAura.style.top = `${e.clientY}px`;
        });

        const interactiveElements = document.querySelectorAll(
            'a, button, .stat-card, .skill-category, .project-card, .timeline-item, .section-title, .nav-link, .hamburger-menu'
        );

        interactiveElements.forEach(el => {
            el.classList.add('interactive-hover-target');
            el.addEventListener('mouseenter', () => {
                cursorAura.classList.add('hovering');
            });
            el.addEventListener('mouseleave', () => {
                cursorAura.classList.remove('hovering');
            });
        });

        // Hide aura if mouse leaves window
        document.addEventListener('mouseleave', () => {
            cursorAura.style.opacity = '0';
        });
        document.addEventListener('mouseenter', () => {
            cursorAura.style.opacity = '0.7';
        });
    }

    // --- Enhanced Card Interactions ---
    const cards = document.querySelectorAll('.stat-card, .skill-category, .project-card');
    
    cards.forEach(card => {
        // Add ripple effect on click
        card.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
        
        // Add tilt effect on mouse move
        card.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            
            this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px) scale(1.05)`;
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
    });

    // --- Parallax effect for hero section ---
    let ticking = false;
    function updateParallax() {
        const scrolled = window.pageYOffset;
        const heroElements = document.querySelectorAll('.hero-title, .hero-subtitle');
        
        heroElements.forEach((el, index) => {
            const speed = 0.5 + (index * 0.1);
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
        requestTick(); // Add parallax effect
    });
    window.addEventListener('resize', () => {
        // Recalculate things if needed on resize
    });

    // Initial call for nav active state
    updateActiveNavLink();
});