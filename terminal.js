/**
 * Contact Section Privacy - Auto-redaction with matrix decode
 */

document.addEventListener('DOMContentLoaded', () => {
    // Auto-apply redactions to contact section only
    setTimeout(() => {
        applyContactRedactions();
    }, 500);
    
    function applyContactRedactions() {
        const contactSection = document.querySelector('#contact .contact-info');
        
        if (!contactSection) return;
        
        if (!contactSection.dataset.originalHtml) {
            contactSection.dataset.originalHtml = contactSection.innerHTML;
        }
        
        // Redact emails
        contactSection.innerHTML = contactSection.innerHTML.replace(
            /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
            '<span class="redacted" data-content="$1">[REDACTED EMAIL]</span>'
        );
        
        // Redact phones
        contactSection.innerHTML = contactSection.innerHTML.replace(
            /\b(\d{3}[-.]?\d{3}[-.]?\d{4})\b/g,
            '<span class="redacted" data-content="$1">[REDACTED PHONE]</span>'
        );
        
        // Add hover handlers
        document.querySelectorAll('#contact .redacted').forEach(element => {
            element.addEventListener('mouseenter', revealOnHover);
            element.addEventListener('mouseleave', hideOnLeave);
        });
    }
    
    function revealOnHover(e) {
        const element = e.target;
        const originalContent = element.getAttribute('data-content');
        
        if (originalContent && !element.classList.contains('revealed')) {
            element.classList.add('revealing');
            
            // Matrix decode effect
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@.-_';
            const contentLength = originalContent.length;
            let iterations = 0;
            const maxIterations = 20;
            
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
                    element.textContent = originalContent;
                    element.classList.remove('revealing');
                    element.classList.add('revealed');
                    element.setAttribute('title', '🔓 DECLASSIFIED - Hover away to re-secure');
                }
            }, 50);
        }
    }
    
    function hideOnLeave(e) {
        const element = e.target;
        
        if (element.classList.contains('revealed')) {
            element.style.transition = 'all 0.3s ease-out';
            element.style.opacity = '0.5';
            
            setTimeout(() => {
                element.classList.remove('revealed');
                const content = element.getAttribute('data-content');
                element.textContent = content.includes('@') ? 
                    '[REDACTED EMAIL]' : 
                    content.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/) ? 
                    '[REDACTED PHONE]' : 
                    '[REDACTED]';
                element.style.opacity = '1';
                element.removeAttribute('title');
            }, 300);
        }
    }
});
