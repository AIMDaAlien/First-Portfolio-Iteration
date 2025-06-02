document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const loader = document.getElementById('loader');
    const startupIntro = document.getElementById('startup-intro');
    const startupQuote = document.getElementById('startup-quote');
    const startupSound = document.getElementById('startup-sound');
    const mainContent = document.getElementById('main-content');
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    const themeToggleButton = document.getElementById('theme-toggle');
    const rippleEffect = document.getElementById('ripple-effect');
    const mainNav = document.getElementById('main-nav');
    const navLinks = document.querySelectorAll('.nav-link');
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const mobileNavUl = document.querySelector('#main-nav ul');

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
        // Browsers often block autoplay without interaction. Best effort.
        const playSoundPromise = startupSound.play();
        if (playSoundPromise !== undefined) {
            playSoundPromise.catch(error => {
                console.warn("Startup sound autoplay was prevented:", error);
                // Optionally, enable sound on first click if autoplay fails
            });
        }

        // 3. Startup Visual Intro
        startupIntro.style.opacity = '1';
        setTimeout(() => {
            startupQuote.style.opacity = '1';
            startupQuote.style.transform = 'scale(1.5)'; // Start large
        }, 100); // Slight delay for intro div to fade in

        setTimeout(() => {
            startupQuote.style.transform = 'scale(0.7)'; // Become smaller
            startupQuote.style.opacity = '0'; // Fade out
        }, 2500); // Duration quote is large

        // 4. Transition to Main Content
        setTimeout(() => {
            startupIntro.style.opacity = '0';
            mainContent.style.display = 'block'; // Show main content structure

            // Smoothly fade in main content sections (or just hero initially)
            setTimeout(() => {
                startupIntro.style.display = 'none'; // Remove from layout
                heroTitle.style.opacity = '1';
                heroTitle.style.transform = 'translateY(0)';
                heroSubtitle.style.opacity = '1';
                heroSubtitle.style.transform = 'translateY(0)';
                scrollIndicator.style.opacity = '1';
                // Trigger scroll animations check in case elements are already in view
                checkElementsVisibility();
            }, 700); // Match startupIntro fade out duration
        }, 4000); // Total time for intro visual (2.5s visible + 1s fade out + buffer)
    }

    // Start after a brief moment to ensure assets are ready (or use window.onload)
    // For simplicity, using a timeout here. A more robust solution would be window.onload.
    setTimeout(startWebsite, 200); // Small delay for loader to be visible


    // --- Theme Toggle ---
    themeToggleButton.addEventListener('click', (e) => {
        const isDarkMode = body.classList.contains('dark-mode');
        const ripple = rippleEffect;

        // Position ripple
        const rect = themeToggleButton.getBoundingClientRect();
        const toggleX = rect.left + rect.width / 2;
        const toggleY = rect.top + rect.height / 2;
        ripple.style.left = `${toggleX}px`;
        ripple.style.top = `${toggleY}px`;

        if (isDarkMode) {
            body.classList.remove('dark-mode');
            body.classList.add('light-mode');
            themeToggleButton.querySelector('.toggle-icon').textContent = '🌙';
            ripple.style.backgroundColor = 'var(--bg-light)'; // Ripple with the new mode's BG
        } else {
            body.classList.remove('light-mode');
            body.classList.add('dark-mode');
            themeToggleButton.querySelector('.toggle-icon').textContent = '☀️';
            ripple.style.backgroundColor = 'var(--bg-dark)';
        }

        ripple.classList.remove('animate');
        void ripple.offsetWidth; // Trigger reflow
        ripple.classList.add('animate');
    });


    // --- Navigation Scroll Active State & Sticky Nav ---
    function updateActiveNavLink() {
        let currentSection = '';
        const sections = document.querySelectorAll('section[id]');
        sections.forEach(section => {
            const sectionTop = section.offsetTop - mainNav.offsetHeight - 50; // Adjust offset
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
        root: null, // viewport
        rootMargin: '0px',
        threshold: 0.1 // 10% of element visible
    };

    function handleIntersect(entries, observer) {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                const el = entry.target;
                // Apply staggered delay if the element has .stagger class
                const delay = el.classList.contains('stagger') ? index * 150 : 0; // 150ms stagger delay
                setTimeout(() => {
                    el.classList.add('is-visible');
                }, delay);
                observer.unobserve(el); // Stop observing once animated
            }
        });
    }

    const scrollObserver = new IntersectionObserver(handleIntersect, observerOptions);

    function checkElementsVisibility() { // Function to manually check on load if needed
        animatedElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top <= (window.innerHeight || document.documentElement.clientHeight) && rect.bottom >= 0) {
                // Simplified check for initial load, for more precise control use IntersectionObserver directly
                const delay = el.classList.contains('stagger') ? Array.from(animatedElements).indexOf(el) * 150 : 0;
                setTimeout(() => {
                    el.classList.add('is-visible');
                }, delay);
                // For elements animated on load without observer, you might not unobserve them
                // If relying solely on observer, this manual check can be more limited
            } else {
                 scrollObserver.observe(el); // If not visible, observe it
            }
        });
    }
    // Initial call to check elements on screen without scrolling (if observer hasn't fired yet)
    // and to start observing other elements.
    // Note: The observer is generally better for performance than manual scroll checks.
    animatedElements.forEach(el => scrollObserver.observe(el));


    // --- Smooth Scrolling (Native CSS scroll-behavior is used, this is for nav link clicks) ---
    // The `html { scroll-behavior: smooth; }` CSS rule handles most of this.
    // This JS ensures that clicking nav links works as expected.
    navLinks.forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href.startsWith('#') && href.length > 1) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    // Calculate position considering fixed nav height
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

    // --- Parallax Scrolling (Simplified - applied to sections via CSS background-attachment: fixed) ---
    // For more advanced JS parallax, you'd update element positions on scroll.
    // The current CSS provides a basic depth effect for sections with background images (if any).
    // If no background images per section, this effect is not visually present from CSS alone.
    // A simple JS parallax for sections could be:
    // window.addEventListener('scroll', () => {
    //     const scrolled = window.pageYOffset;
    //     document.querySelectorAll('.content-section').forEach((section, index) => {
    //         // Example: move section slightly slower than scroll
    //         const speed = 0.1 * (index + 1); // Different speed for each section
    //         // section.style.transform = `translateY(${scrolled * -speed}px)`; // This can interfere with scroll animations
    //         // Be cautious with transform-based parallax on many elements for performance.
    //     });
    // });
    // Decided to rely on CSS `background-attachment: fixed` for simplicity and performance.

    // --- Event Listeners ---
    window.addEventListener('scroll', () => {
        updateActiveNavLink();
        // checkElementsVisibility(); // Re-enable if not solely relying on IntersectionObserver
    });
    window.addEventListener('resize', () => {
        // Recalculate things if needed on resize, e.g., mobile menu behavior
    });

    // Initial call for nav active state
    updateActiveNavLink();
});