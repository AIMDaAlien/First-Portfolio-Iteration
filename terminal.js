/**
 * Contact Section Privacy - Auto-redaction with matrix decode
 *
 * Replaces emails and phone numbers in the contact section with redacted
 * placeholders. The replacement is performed on text nodes and mailto hrefs
 * only, so the surrounding HTML structure stays intact.
 */

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        applyContactRedactions();
    }, 500);

    function applyContactRedactions() {
        const contactSection = document.querySelector('#contact .contact-info');
        if (!contactSection) return;

        if (!contactSection.dataset.originalHtml) {
            contactSection.dataset.originalHtml = contactSection.innerHTML;
        }

        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
        const phoneRegex = /\b(\d{3}[-.]?\d{3}[-.]?\d{4})\b/g;

        // Redact visible text nodes.
        const walker = document.createTreeWalker(
            contactSection,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        const textNodes = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (emailRegex.test(node.textContent) || phoneRegex.test(node.textContent)) {
                textNodes.push(node);
            }
            emailRegex.lastIndex = 0;
            phoneRegex.lastIndex = 0;
        }

        textNodes.forEach(node => {
            const wrapper = document.createElement('span');
            let html = node.textContent
                .replace(emailRegex, '<span class="redacted" data-content="$1">[REDACTED EMAIL]</span>')
                .replace(phoneRegex, '<span class="redacted" data-content="$1">[REDACTED PHONE]</span>');
            wrapper.innerHTML = html;
            node.parentNode.replaceChild(wrapper, node);
        });

        // Redact mailto hrefs without corrupting the anchor tag.
        contactSection.querySelectorAll('a[href^="mailto:"]').forEach(anchor => {
            const href = anchor.getAttribute('href');
            const match = href.match(/^mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
            if (match) {
                anchor.dataset.originalHref = href;
                anchor.setAttribute('href', 'mailto:[REDACTED EMAIL]');
                anchor.classList.add('redacted');
            }
        });

        // Add hover / focus / click handlers.
        document.querySelectorAll('#contact .redacted').forEach(element => {
            element.setAttribute('tabindex', '0');
            element.setAttribute('role', 'button');
            element.setAttribute('aria-expanded', 'false');
            element.setAttribute('aria-label', 'Reveal redacted contact information');
            element.addEventListener('mouseenter', revealOnHover);
            element.addEventListener('mouseleave', hideOnLeave);
            element.addEventListener('focus', revealOnHover);
            element.addEventListener('blur', hideOnLeave);
            element.addEventListener('click', revealOnHover);
            element.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (element.classList.contains('revealed')) {
                        hideOnLeave({ target: element });
                    } else {
                        revealOnHover({ target: element });
                    }
                }
            });
        });
    }

    function revealOnHover(e) {
        const element = e.target;
        const originalContent = element.getAttribute('data-content');

        if (!originalContent || element.classList.contains('revealed') || element.classList.contains('revealing')) {
            return;
        }

        element.classList.add('revealing');
        element.setAttribute('aria-expanded', 'true');

        // Restore the real mailto href while revealed.
        if (element.dataset.originalHref) {
            element.setAttribute('href', element.dataset.originalHref);
        }

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@.-_';
        const contentLength = originalContent.length;
        let iterations = 0;
        const maxIterations = 20;

        if (element._decodeInterval) {
            clearInterval(element._decodeInterval);
        }

        const interval = setInterval(() => {
            element.textContent = originalContent
                .split('')
                .map((char, index) => {
                    if (index < iterations) {
                        return originalContent[index];
                    }
                    return chars[Math.floor(Math.random() * chars.length)];
                })
                .join('');

            iterations += contentLength / maxIterations;

            if (iterations >= contentLength) {
                clearInterval(interval);
                element._decodeInterval = null;
                element.textContent = originalContent;
                element.classList.remove('revealing');
                element.classList.add('revealed');
                element.setAttribute('title', 'Revealed. Move focus away to hide.');
            }
        }, 50);
        element._decodeInterval = interval;
    }

    function hideOnLeave(e) {
        const element = e.target;

        if (element._decodeInterval) {
            clearInterval(element._decodeInterval);
            element._decodeInterval = null;
        }

        if (element.classList.contains('revealed') || element.classList.contains('revealing')) {
            element.style.transition = 'all 0.3s ease-out';
            element.style.opacity = '0.5';
            element.setAttribute('aria-expanded', 'false');

            setTimeout(() => {
                element.classList.remove('revealed', 'revealing');
                const content = element.getAttribute('data-content');
                if (content) {
                    element.textContent = content.includes('@')
                        ? '[REDACTED EMAIL]'
                        : content.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/)
                        ? '[REDACTED PHONE]'
                        : '[REDACTED]';
                }
                // Restore redacted mailto href.
                if (element.dataset.originalHref) {
                    element.setAttribute('href', 'mailto:[REDACTED EMAIL]');
                }
                element.style.opacity = '1';
                element.removeAttribute('title');
            }, 300);
        }
    }
});
