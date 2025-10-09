/**
 * Terminal Emulator and Privacy Mode Implementation
 * Author: Aim's Portfolio
 * Confidence Level: 95%
 */

// Terminal Command System
const terminalCommands = {
    help: {
        description: 'Show available commands',
        execute: () => {
            return `
<span class="terminal-highlight">Available Commands:</span>

  <span class="terminal-command">about</span>      - Learn about me
  <span class="terminal-command">skills</span>     - View my technical skills
  <span class="terminal-command">projects</span>   - Browse my projects
  <span class="terminal-command">experience</span> - View my work experience
  <span class="terminal-command">contact</span>    - Get my contact information
  <span class="terminal-command">education</span>  - View my education
  <span class="terminal-command">clear</span>      - Clear terminal screen
  <span class="terminal-command">github</span>     - Open my GitHub profile
  <span class="terminal-command">linkedin</span>   - Open my LinkedIn profile
  <span class="terminal-command">resume</span>     - Download my resume
  <span class="terminal-command">secret</span>     - ???
  <span class="terminal-command">help</span>       - Show this help message

<span class="terminal-info">Tip: Use Tab for command autocomplete</span>`;
        }
    },
    about: {
        description: 'About me',
        execute: () => {
            return `
<span class="terminal-highlight">Abdullah "Aim" Ibn Masud</span>
IT Professional | Privacy Advocate | Homelab Enthusiast

Passionate about crafting secure, efficient systems and advocating for digital privacy.
Currently pursuing BS in Information Technology at George Mason University (Expected 2028).

<span class="terminal-info">Type 'skills' to see my technical expertise</span>`;
        }
    },
    skills: {
        description: 'Technical skills',
        execute: () => {
            return `
<span class="terminal-highlight">Technical Skills:</span>

<span class="terminal-category">Operating Systems:</span>
  • Linux (7+ years) - Ubuntu, Debian, Arch
  • GrapheneOS (Privacy-focused Android)
  • Windows Server Administration

<span class="terminal-category">Networking & Security:</span>
  • Pi-hole (DNS filtering)
  • WireGuard VPN
  • Network troubleshooting
  • Privacy-focused configurations

<span class="terminal-category">Development:</span>
  • Python, JavaScript, Bash
  • Git version control
  • API integration
  • System automation

<span class="terminal-category">Homelab:</span>
  • TrueNAS (Storage management)
  • Docker containerization
  • Self-hosted services
  • Hardware troubleshooting (7+ years)`;
        }
    },
    projects: {
        description: 'View projects',
        execute: () => {
            return `
<span class="terminal-highlight">Featured Projects:</span>

<span class="terminal-project">1. Home Network Infrastructure</span>
   • Pi-hole DNS filtering for network-wide ad blocking
   • WireGuard VPN for secure remote access
   • Custom monitoring dashboard

<span class="terminal-project">2. TrueNAS Storage Solution</span>
   • 20TB redundant storage array
   • Automated backups and snapshots
   • Media server integration

<span class="terminal-project">3. Privacy-First Mobile Setup</span>
   • GrapheneOS deployment
   • Secure app sandboxing
   • Complete de-googling guide

<span class="terminal-info">Visit my GitHub for more: github.com/AIMDaAlien</span>`;
        }
    },
    experience: {
        description: 'Work experience',
        execute: () => {
            return `
<span class="terminal-highlight">Professional Experience:</span>

<span class="terminal-job">Micro Center | Sales Associate</span>
<span class="terminal-date">September 2023 - Present</span>
  • Hardware diagnostics and troubleshooting
  • Customer technical consultation
  • System building recommendations

<span class="terminal-job">Self-Employed | IT Consultant</span>
<span class="terminal-date">2020 - Present</span>
  • Network setup and optimization
  • Privacy and security consulting
  • Custom PC builds and repairs`;
        }
    },
    contact: {
        description: 'Contact information',
        execute: () => {
            return `
<span class="terminal-highlight">Contact Information:</span>

<span class="terminal-contact">📧 Email:</span> Use the contact form below
<span class="terminal-contact">💼 LinkedIn:</span> linkedin.com/in/abdullah-masud
<span class="terminal-contact">🐙 GitHub:</span> github.com/AIMDaAlien

<span class="terminal-info">For direct contact, use the form in the Contact section</span>`;
        }
    },
    education: {
        description: 'Education details',
        execute: () => {
            return `
<span class="terminal-highlight">Education:</span>

<span class="terminal-school">George Mason University</span>
Bachelor of Science in Information Technology
Expected Graduation: 2028

<span class="terminal-category">Relevant Coursework:</span>
  • Network Security
  • System Administration
  • Database Management
  • Software Development`;
        }
    },
    clear: {
        description: 'Clear terminal',
        execute: () => {
            const output = document.getElementById('terminal-output');
            output.innerHTML = '';
            return null;
        }
    },
    github: {
        description: 'Open GitHub profile',
        execute: () => {
            window.open('https://github.com/AIMDaAlien', '_blank');
            return '<span class="terminal-success">Opening GitHub profile...</span>';
        }
    },
    linkedin: {
        description: 'Open LinkedIn profile',
        execute: () => {
            window.open('https://linkedin.com/in/abdullah-masud', '_blank');
            return '<span class="terminal-success">Opening LinkedIn profile...</span>';
        }
    },
    resume: {
        description: 'Download resume',
        execute: () => {
            // Placeholder for resume download
            return '<span class="terminal-warning">Resume download coming soon. Use contact form for now.</span>';
        }
    },
    secret: {
        description: 'Hidden command',
        execute: () => {
            return `
<span class="terminal-secret">🔒 Secret Mode Activated</span>

You found the secret command! Here's a fun fact:
I've been using Linux since I was 13, starting with Ubuntu on an old ThinkPad.

<span class="terminal-info">There might be more secrets... try 'matrix'</span>`;
        }
    },
    matrix: {
        description: 'Matrix mode',
        execute: () => {
            document.body.classList.add('matrix-mode');
            setTimeout(() => {
                document.body.classList.remove('matrix-mode');
            }, 5000);
            return '<span class="terminal-matrix">Entering the Matrix... (5 seconds)</span>';
        }
    }
};

// Terminal History Management
let commandHistory = [];
let historyIndex = -1;

// Initialize Terminal
document.addEventListener('DOMContentLoaded', () => {
    const terminalInput = document.getElementById('terminal-input');
    const terminalOutput = document.getElementById('terminal-output');
    const hintButton = document.getElementById('terminal-hint');
    
    if (!terminalInput || !terminalOutput) return;
    
    // Focus on terminal input when clicking terminal body
    const terminalBody = document.querySelector('.terminal-body');
    terminalBody.addEventListener('click', () => {
        terminalInput.focus();
    });
    
    // Handle terminal input
    terminalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            executeCommand(terminalInput.value);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateHistory('up');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateHistory('down');
        } else if (e.key === 'Tab') {
            e.preventDefault();
            autocomplete(terminalInput.value);
        }
    });
    
    // Hint button functionality
    hintButton.addEventListener('click', () => {
        executeCommand('help');
        terminalInput.focus();
    });
    
    function executeCommand(command) {
        const trimmedCommand = command.trim().toLowerCase();
        
        // Add to output
        addToOutput(`<span class="terminal-prompt">aim@portfolio:~$</span> ${command}`);
        
        // Add to history
        if (trimmedCommand) {
            commandHistory.push(trimmedCommand);
            historyIndex = commandHistory.length;
        }
        
        // Execute command
        if (trimmedCommand === '') {
            // Empty command, just add a new line
        } else if (terminalCommands[trimmedCommand]) {
            const result = terminalCommands[trimmedCommand].execute();
            if (result) {
                addToOutput(result);
            }
        } else {
            addToOutput(`<span class="terminal-error">Command not found: ${command}</span>`);
            addToOutput(`<span class="terminal-info">Type 'help' for available commands</span>`);
        }
        
        // Clear input
        terminalInput.value = '';
        
        // Scroll to bottom
        terminalBody.scrollTop = terminalBody.scrollHeight;
    }
    
    function addToOutput(content) {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = content;
        terminalOutput.appendChild(line);
    }
    
    function navigateHistory(direction) {
        if (direction === 'up' && historyIndex > 0) {
            historyIndex--;
            terminalInput.value = commandHistory[historyIndex];
        } else if (direction === 'down' && historyIndex < commandHistory.length - 1) {
            historyIndex++;
            terminalInput.value = commandHistory[historyIndex];
        } else if (direction === 'down' && historyIndex === commandHistory.length - 1) {
            historyIndex = commandHistory.length;
            terminalInput.value = '';
        }
    }
    
    function autocomplete(partial) {
        const matches = Object.keys(terminalCommands).filter(cmd => 
            cmd.startsWith(partial.toLowerCase())
        );
        
        if (matches.length === 1) {
            terminalInput.value = matches[0];
        } else if (matches.length > 1) {
            addToOutput(`<span class="terminal-prompt">aim@portfolio:~$</span> ${partial}`);
            addToOutput(`<span class="terminal-info">Available commands: ${matches.join(', ')}</span>`);
        }
    }
});

// Privacy Mode Implementation
document.addEventListener('DOMContentLoaded', () => {
    const privacyToggle = document.getElementById('privacy-toggle');
    const sensitiveElements = [];
    
    // Define sensitive data patterns
    const sensitivePatterns = [
        { selector: '.contact-form input[name="reply_to"]', type: 'email' },
        { selector: '.terminal-contact', type: 'contact' },
        { selector: 'a[href*="linkedin"]', type: 'link' },
        { selector: 'a[href*="github"]', type: 'link' }
    ];
    
    // Privacy mode state
    let privacyModeActive = false;
    
    privacyToggle.addEventListener('click', () => {
        privacyModeActive = !privacyModeActive;
        togglePrivacyMode();
    });
    
    function togglePrivacyMode() {
        const body = document.body;
        const icon = privacyToggle.querySelector('.privacy-icon');
        
        if (privacyModeActive) {
            body.classList.add('privacy-mode');
            icon.textContent = '🔒';
            privacyToggle.classList.add('active');
            applyRedactions();
        } else {
            body.classList.remove('privacy-mode');
            icon.textContent = '👁️';
            privacyToggle.classList.remove('active');
            removeRedactions();
        }
    }
    
    function applyRedactions() {
        // Add redaction bars to sensitive content
        document.querySelectorAll('.content-section').forEach(section => {
            // Find email addresses
            section.innerHTML = section.innerHTML.replace(
                /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
                '<span class="redacted" data-content="$1@$2">[REDACTED EMAIL]</span>'
            );
            
            // Find phone numbers (basic pattern)
            section.innerHTML = section.innerHTML.replace(
                /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
                '<span class="redacted" data-content="$&">[REDACTED PHONE]</span>'
            );
        });
        
        // Add hover reveal functionality
        document.querySelectorAll('.redacted').forEach(element => {
            element.addEventListener('mouseenter', revealOnHover);
            element.addEventListener('mouseleave', hideOnLeave);
        });
    }
    
    function removeRedactions() {
        document.querySelectorAll('.redacted').forEach(element => {
            const originalContent = element.getAttribute('data-content');
            if (originalContent) {
                element.outerHTML = originalContent;
            }
        });
    }
    
    function revealOnHover(e) {
        const element = e.target;
        const originalContent = element.getAttribute('data-content');
        if (originalContent && privacyModeActive) {
            element.classList.add('revealing');
            setTimeout(() => {
                element.textContent = originalContent;
                element.classList.add('revealed');
            }, 200);
        }
    }
    
    function hideOnLeave(e) {
        const element = e.target;
        if (privacyModeActive && element.classList.contains('revealed')) {
            element.classList.remove('revealed', 'revealing');
            element.textContent = element.textContent.includes('@') ? 
                '[REDACTED EMAIL]' : '[REDACTED PHONE]';
        }
    }
});

// Add keyboard shortcut for privacy mode (Ctrl+Shift+P)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        const privacyToggle = document.getElementById('privacy-toggle');
        if (privacyToggle) {
            privacyToggle.click();
        }
    }
});
