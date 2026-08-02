/**
 * Contact Section Privacy - deliberate reveal with matrix decode
 */

document.addEventListener('DOMContentLoaded', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.querySelectorAll('[data-contact-user][data-contact-domain]').forEach(control => {
        const container = control.closest('.contact-obfuscation');
        if (!container) return;

        const redactedLabel = control.textContent;
        let decodeInterval;
        let hideTimer;

        const clearDecode = () => {
            if (decodeInterval) {
                clearInterval(decodeInterval);
                decodeInterval = undefined;
            }
        };

        const removeMailLink = () => {
            const mailLink = container.querySelector('.contact-mail-link');
            if (mailLink) mailLink.remove();
        };

        const hide = () => {
            clearDecode();
            container.classList.remove('is-decoding', 'is-revealed');
            control.textContent = redactedLabel;
            control.setAttribute('aria-expanded', 'false');
            control.setAttribute('aria-label', 'Reveal email address');
            removeMailLink();
        };

        const addMailLink = address => {
            if (container.querySelector('.contact-mail-link')) return;

            const mailLink = document.createElement('a');
            mailLink.className = 'contact-mail-link';
            mailLink.href = `mail${'to:'}${address}`;
            mailLink.textContent = 'Open mail client';
            mailLink.setAttribute('aria-label', 'Send email');
            container.append(mailLink);
        };

        const finishReveal = address => {
            clearDecode();
            control.textContent = address;
            control.setAttribute('aria-label', `Email address ${address}`);
            container.classList.remove('is-decoding');
            container.classList.add('is-revealed');
        };

        const reveal = () => {
            clearTimeout(hideTimer);
            if (container.classList.contains('is-decoding') || container.classList.contains('is-revealed')) {
                return;
            }

            const address = `${control.dataset.contactUser}@${control.dataset.contactDomain}`;
            control.setAttribute('aria-expanded', 'true');
            addMailLink(address);

            if (reduceMotion) {
                finishReveal(address);
                return;
            }

            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@.-_';
            let progress = 0;
            const step = Math.max(1, Math.ceil(address.length / 20));
            container.classList.add('is-decoding');

            decodeInterval = window.setInterval(() => {
                control.textContent = address.split('').map((character, index) => (
                    index < progress ? character : chars[Math.floor(Math.random() * chars.length)]
                )).join('');
                progress += step;

                if (progress >= address.length) finishReveal(address);
            }, 50);
        };

        const scheduleHide = () => {
            clearTimeout(hideTimer);
            hideTimer = window.setTimeout(() => {
                if (!container.matches(':hover') && !container.contains(document.activeElement)) hide();
            }, 100);
        };

        control.addEventListener('mouseenter', reveal);
        control.addEventListener('focus', reveal);
        control.addEventListener('click', reveal);
        control.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                hide();
                control.focus();
            }
        });
        container.addEventListener('mouseleave', scheduleHide);
        container.addEventListener('focusout', scheduleHide);
    });
});
