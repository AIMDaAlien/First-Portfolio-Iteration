/**
 * Knowledge Garden Terminal
 * A UNIX-like terminal interface for browsing documentation
 * With M3 Expressive aesthetics
 */

class KnowledgeGardenTerminal {
    constructor() {
        // GitHub Configuration
        this.vaultOwner = 'AIMDaAlien';
        this.vaultRepo = 'knowledge-garden-vault';
        this.branch = 'main';

        // Terminal State
        this.currentPath = '~';
        this.homeDir = '~';
        this.commandHistory = [];
        this.historyIndex = -1;
        this.noteCache = new Map();

        // Virtual Filesystem
        this.filesystem = {
            '~': {
                type: 'dir',
                children: {
                    'featured': {
                        type: 'dir',
                        children: {
                            'grapheneos-migration.md': { type: 'file', path: 'GrapheneOS Migration Guide - Complete Documentation.md' },
                            'truenas-build.md': { type: 'file', path: 'TrueNAS Build Guide.md' },
                            'pihole-setup.md': { type: 'file', path: 'Homelab/Pi-hole Setup Guide - Complete Journey.md' },
                            'wireguard-vpn.md': { type: 'file', path: 'WireGuard VPN Setup.md' }
                        }
                    },
                    'projects': {
                        type: 'dir',
                        children: {
                            'budget-nas.md': { type: 'file', path: 'Projects/Budget SAS Drive NAS Build Guide.md' }
                        }
                    },
                    'homelab': {
                        type: 'dir',
                        children: {
                            'router-optimization.md': { type: 'file', path: 'Router/Optimization Guide.md' }
                        }
                    },
                    'README.md': { type: 'file', path: '🗺️ Knowledge Base - Main Index.md' }
                }
            }
        };

        // DOM Elements
        this.outputEl = document.getElementById('terminalOutput');
        this.inputEl = document.getElementById('terminalInput');
        this.promptPathEl = document.querySelector('.prompt-path');
        this.statusPathEl = document.getElementById('statusPath');
        this.statusTimeEl = document.getElementById('statusTime');
        this.titleEl = document.getElementById('terminalTitle');
        this.maximizeBtn = document.getElementById('maximizeBtn');
        this.terminalWindow = document.getElementById('terminalWindow');
        this.titlebar = document.querySelector('.terminal-titlebar');

        // Drag State
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.windowPosition = { x: 0, y: 0 };

        // Initialize
        this.init();
    }

    init() {
        // Bind events
        this.inputEl.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.maximizeBtn.addEventListener('click', () => this.toggleMaximize());

        // Drag functionality
        this.initDraggable();

        // Restore saved position
        this.restorePosition();

        // Update time
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);

        // Focus input (but not on titlebar)
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.terminal-titlebar') && !e.target.closest('.quick-actions')) {
                this.inputEl.focus();
            }
        });

        // Show welcome message
        this.showWelcome();

        // Load command history from localStorage
        const savedHistory = localStorage.getItem('terminal-history');
        if (savedHistory) {
            this.commandHistory = JSON.parse(savedHistory);
        }

        // Setup quick action buttons
        this.setupQuickActions();
    }

    // ============================================
    // DRAGGABLE WINDOW
    // ============================================

    initDraggable() {
        this.titlebar.addEventListener('mousedown', (e) => this.startDrag(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.endDrag());

        // Touch support
        this.titlebar.addEventListener('touchstart', (e) => this.startDrag(e.touches[0]), { passive: false });
        document.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                e.preventDefault();
                this.drag(e.touches[0]);
            }
        }, { passive: false });
        document.addEventListener('touchend', () => this.endDrag());
    }

    startDrag(e) {
        // Don't drag if clicking controls
        if (e.target.closest('.control-btn') || e.target.closest('.tab-btn')) return;

        this.isDragging = true;
        this.titlebar.style.cursor = 'grabbing';

        const rect = this.terminalWindow.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        // Remove centering
        this.terminalWindow.style.position = 'fixed';
        this.terminalWindow.style.margin = '0';
        this.terminalWindow.style.left = rect.left + 'px';
        this.terminalWindow.style.top = rect.top + 'px';
        this.terminalWindow.style.transform = 'none';
    }

    drag(e) {
        if (!this.isDragging) return;

        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;

        // Keep within viewport bounds
        const maxX = window.innerWidth - this.terminalWindow.offsetWidth;
        const maxY = window.innerHeight - this.terminalWindow.offsetHeight;

        this.windowPosition = {
            x: Math.max(0, Math.min(x, maxX)),
            y: Math.max(0, Math.min(y, maxY))
        };

        this.terminalWindow.style.left = this.windowPosition.x + 'px';
        this.terminalWindow.style.top = this.windowPosition.y + 'px';
    }

    endDrag() {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.titlebar.style.cursor = 'grab';

        // Save position
        localStorage.setItem('terminal-position', JSON.stringify(this.windowPosition));

        // Spring settle animation
        this.terminalWindow.style.transition = 'transform 0.3s var(--motion-spring-bouncy)';
        this.terminalWindow.style.transform = 'scale(1)';
        setTimeout(() => {
            this.terminalWindow.style.transition = '';
        }, 300);
    }

    restorePosition() {
        const saved = localStorage.getItem('terminal-position');
        if (saved) {
            const pos = JSON.parse(saved);
            this.windowPosition = pos;
            this.terminalWindow.style.position = 'fixed';
            this.terminalWindow.style.margin = '0';
            this.terminalWindow.style.left = pos.x + 'px';
            this.terminalWindow.style.top = pos.y + 'px';
            this.terminalWindow.style.transform = 'none';
        }
    }

    // ============================================
    // QUICK ACTIONS (for non-terminal users)
    // ============================================

    setupQuickActions() {
        const actionsContainer = document.getElementById('quickActions');
        if (!actionsContainer) return;

        actionsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.quick-action-btn');
            if (!btn) return;

            const cmd = btn.dataset.cmd;
            if (cmd) {
                this.inputEl.value = cmd;
                this.executeCommand(cmd);
                this.inputEl.value = '';
            }
        });
    }

    // ============================================
    // OUTPUT METHODS
    // ============================================

    print(content, className = '') {
        const line = document.createElement('div');
        line.className = `output-line ${className}`;
        line.innerHTML = content;
        this.outputEl.appendChild(line);
        this.scrollToBottom();
    }

    printCommand(cmd) {
        const promptHtml = `<span class="cmd-prompt"><span style="color: var(--terminal-green)">aim</span>@<span style="color: var(--terminal-cyan)">garden</span> <span style="color: var(--terminal-blue)">${this.currentPath}</span> <span style="color: var(--md-sys-color-primary)">❯</span></span> `;
        this.print(promptHtml + this.escapeHtml(cmd), 'output-command');
    }

    printError(msg) {
        this.print(msg, 'output-error');
    }

    printSuccess(msg) {
        this.print(msg, 'output-success');
    }

    printInfo(msg) {
        this.print(msg, 'output-info');
    }

    printMuted(msg) {
        this.print(msg, 'output-muted');
    }

    scrollToBottom() {
        this.outputEl.scrollTop = this.outputEl.scrollHeight;
    }

    clear() {
        this.outputEl.innerHTML = '';
    }

    // ============================================
    // INPUT HANDLING
    // ============================================

    handleKeydown(e) {
        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                this.executeCommand(this.inputEl.value.trim());
                this.inputEl.value = '';
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.navigateHistory(-1);
                break;

            case 'ArrowDown':
                e.preventDefault();
                this.navigateHistory(1);
                break;

            case 'Tab':
                e.preventDefault();
                this.tabComplete();
                break;

            case 'l':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.clear();
                }
                break;

            case 'c':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.printCommand(this.inputEl.value + '^C');
                    this.inputEl.value = '';
                }
                break;
        }
    }

    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return;

        this.historyIndex += direction;

        if (this.historyIndex < 0) {
            this.historyIndex = 0;
        } else if (this.historyIndex >= this.commandHistory.length) {
            this.historyIndex = this.commandHistory.length;
            this.inputEl.value = '';
            return;
        }

        this.inputEl.value = this.commandHistory[this.historyIndex];
    }

    tabComplete() {
        const input = this.inputEl.value;
        const parts = input.split(' ');
        const lastPart = parts[parts.length - 1];

        // Get current directory contents
        const currentDir = this.resolvePath(this.currentPath);
        if (!currentDir || currentDir.type !== 'dir') return;

        const matches = Object.keys(currentDir.children).filter(name =>
            name.startsWith(lastPart)
        );

        if (matches.length === 1) {
            parts[parts.length - 1] = matches[0];
            this.inputEl.value = parts.join(' ');
        } else if (matches.length > 1) {
            this.printCommand(input);
            this.print(matches.join('  '), 'output-muted');
        }
    }

    // ============================================
    // COMMAND EXECUTION
    // ============================================

    executeCommand(input) {
        if (!input) {
            this.printCommand('');
            return;
        }

        // Add to history
        this.commandHistory.push(input);
        this.historyIndex = this.commandHistory.length;

        // Save history
        localStorage.setItem('terminal-history', JSON.stringify(this.commandHistory.slice(-50)));

        // Print command
        this.printCommand(input);

        // Parse command
        const [cmd, ...args] = input.split(/\s+/);

        // Execute
        switch (cmd.toLowerCase()) {
            case 'ls':
                this.cmdLs(args);
                break;
            case 'cd':
                this.cmdCd(args);
                break;
            case 'pwd':
                this.cmdPwd();
                break;
            case 'cat':
                this.cmdCat(args);
                break;
            case 'clear':
                this.clear();
                break;
            case 'help':
                this.cmdHelp(args);
                break;
            case 'tree':
                this.cmdTree();
                break;
            case 'grep':
                this.cmdGrep(args);
                break;
            case 'whoami':
                this.cmdWhoami();
                break;
            case 'neofetch':
                this.cmdNeofetch();
                break;
            case 'exit':
                this.cmdExit();
                break;
            default:
                this.printError(`zsh: command not found: ${cmd}`);
                this.printMuted(`Type 'help' for available commands`);
        }
    }

    // ============================================
    // COMMANDS
    // ============================================

    cmdLs(args) {
        const showHidden = args.includes('-a') || args.includes('-la') || args.includes('-al');
        const showDetails = args.includes('-l') || args.includes('-la') || args.includes('-al');

        const targetPath = args.find(a => !a.startsWith('-')) || this.currentPath;
        const dir = this.resolvePath(targetPath);

        if (!dir) {
            this.printError(`ls: cannot access '${targetPath}': No such file or directory`);
            return;
        }

        if (dir.type !== 'dir') {
            this.print(targetPath.split('/').pop(), 'output-file');
            return;
        }

        const entries = Object.entries(dir.children);

        if (entries.length === 0) {
            return; // Empty directory
        }

        if (showDetails) {
            entries.forEach(([name, item]) => {
                const isDir = item.type === 'dir';
                const typeChar = isDir ? 'd' : '-';
                const perms = isDir ? 'rwxr-xr-x' : 'rw-r--r--';
                const size = isDir ? '4096' : '2048';
                const date = 'Dec  8 19:00';
                const className = isDir ? 'output-dir' : 'output-file';

                this.print(`${typeChar}${perms}  1 aim aim  ${size.padStart(5)} ${date} <span class="${className}">${name}</span>`);
            });
        } else {
            const output = entries.map(([name, item]) => {
                const className = item.type === 'dir' ? 'output-dir' : 'output-file';
                return `<span class="${className}">${name}</span>`;
            }).join('  ');
            this.print(output);
        }
    }

    cmdCd(args) {
        if (args.length === 0 || args[0] === '~') {
            this.currentPath = '~';
            this.updatePrompt();
            return;
        }

        let targetPath = args[0];

        // Handle relative paths
        if (!targetPath.startsWith('~') && !targetPath.startsWith('/')) {
            targetPath = this.currentPath === '~' ? `~/${targetPath}` : `${this.currentPath}/${targetPath}`;
        }

        // Handle ..
        if (targetPath.includes('..')) {
            const parts = targetPath.split('/').filter(p => p);
            const resolved = [];
            for (const part of parts) {
                if (part === '..') {
                    resolved.pop();
                } else if (part !== '.') {
                    resolved.push(part);
                }
            }
            targetPath = resolved.length === 0 ? '~' : resolved.join('/');
            if (!targetPath.startsWith('~')) targetPath = '~/' + targetPath;
        }

        // Clean up path
        targetPath = targetPath.replace(/\/+/g, '/').replace(/\/$/, '') || '~';

        const dir = this.resolvePath(targetPath);

        if (!dir) {
            this.printError(`cd: no such file or directory: ${args[0]}`);
            return;
        }

        if (dir.type !== 'dir') {
            this.printError(`cd: not a directory: ${args[0]}`);
            return;
        }

        this.currentPath = targetPath;
        this.updatePrompt();
    }

    cmdPwd() {
        const fullPath = this.currentPath.replace('~', '/home/aim/knowledge-garden');
        this.print(fullPath);
    }

    async cmdCat(args) {
        if (args.length === 0) {
            this.printError('cat: missing file operand');
            return;
        }

        const filename = args[0];
        let targetPath = filename;

        if (!filename.startsWith('~') && !filename.startsWith('/')) {
            targetPath = this.currentPath === '~' ? `~/${filename}` : `${this.currentPath}/${filename}`;
        }

        const file = this.resolvePath(targetPath);

        if (!file) {
            this.printError(`cat: ${filename}: No such file or directory`);
            return;
        }

        if (file.type === 'dir') {
            this.printError(`cat: ${filename}: Is a directory`);
            return;
        }

        // Fetch content from GitHub
        this.printMuted('Loading...');

        try {
            const content = await this.fetchNote(file.path);

            // Remove the loading message
            this.outputEl.lastChild.remove();

            // Parse and render markdown
            const html = this.renderMarkdown(content);

            const container = document.createElement('div');
            container.className = 'cat-output';
            container.innerHTML = html;
            this.outputEl.appendChild(container);
            this.scrollToBottom();

        } catch (error) {
            this.outputEl.lastChild.remove();
            this.printError(`cat: ${filename}: Error reading file`);
        }
    }

    cmdHelp(args) {
        if (args.length > 0) {
            // Specific command help
            const cmd = args[0];
            const helpTexts = {
                'ls': 'ls [-la] [path] - list directory contents\n  -l  use long listing format\n  -a  include hidden files',
                'cd': 'cd [path] - change directory\n  cd ~     go to home\n  cd ..    go up one level',
                'cat': 'cat <file> - display file contents with markdown rendering',
                'tree': 'tree - display directory tree structure',
                'grep': 'grep <pattern> - search for pattern in all notes',
                'pwd': 'pwd - print working directory',
                'clear': 'clear - clear terminal screen (or Ctrl+L)',
                'neofetch': 'neofetch - display system information',
                'whoami': 'whoami - display user information',
                'exit': 'exit - return to portfolio'
            };

            if (helpTexts[cmd]) {
                this.print(helpTexts[cmd]);
            } else {
                this.printError(`help: no help available for '${cmd}'`);
            }
            return;
        }

        this.print(`
<div class="help-table">
  <div class="help-row"><span class="help-cmd">ls</span><span class="help-desc">List directory contents</span></div>
  <div class="help-row"><span class="help-cmd">cd</span><span class="help-desc">Change directory</span></div>
  <div class="help-row"><span class="help-cmd">cat</span><span class="help-desc">Display file contents</span></div>
  <div class="help-row"><span class="help-cmd">pwd</span><span class="help-desc">Print working directory</span></div>
  <div class="help-row"><span class="help-cmd">tree</span><span class="help-desc">Show directory tree</span></div>
  <div class="help-row"><span class="help-cmd">grep</span><span class="help-desc">Search notes</span></div>
  <div class="help-row"><span class="help-cmd">neofetch</span><span class="help-desc">System information</span></div>
  <div class="help-row"><span class="help-cmd">whoami</span><span class="help-desc">User information</span></div>
  <div class="help-row"><span class="help-cmd">clear</span><span class="help-desc">Clear terminal</span></div>
  <div class="help-row"><span class="help-cmd">exit</span><span class="help-desc">Return to portfolio</span></div>
</div>
<span class="output-muted">Type 'help &lt;command&gt;' for more details</span>`);
    }

    cmdTree() {
        const lines = [];

        const traverse = (node, prefix = '', isLast = true, name = '~') => {
            const connector = isLast ? '└── ' : '├── ';
            const className = node.type === 'dir' ? 'tree-dir' : 'tree-file';
            lines.push(`${prefix}${connector}<span class="${className}">${name}</span>`);

            if (node.type === 'dir' && node.children) {
                const entries = Object.entries(node.children);
                entries.forEach(([childName, child], index) => {
                    const isChildLast = index === entries.length - 1;
                    const newPrefix = prefix + (isLast ? '    ' : '│   ');
                    traverse(child, newPrefix, isChildLast, childName);
                });
            }
        };

        this.print('<span class="tree-dir">.</span>');
        const root = this.filesystem['~'];
        const entries = Object.entries(root.children);
        entries.forEach(([name, node], index) => {
            traverse(node, '', index === entries.length - 1, name);
        });

        const dirCount = this.countItems(root, 'dir');
        const fileCount = this.countItems(root, 'file');
        this.print(`\n${dirCount} directories, ${fileCount} files`, 'output-muted');
    }

    async cmdGrep(args) {
        if (args.length === 0) {
            this.printError('grep: missing pattern');
            return;
        }

        const pattern = args.join(' ').toLowerCase();
        this.printMuted(`Searching for "${pattern}"...`);

        const results = [];

        const searchDir = (node, path) => {
            if (node.type === 'file') {
                if (path.toLowerCase().includes(pattern)) {
                    results.push(path);
                }
            } else if (node.children) {
                Object.entries(node.children).forEach(([name, child]) => {
                    searchDir(child, `${path}/${name}`);
                });
            }
        };

        searchDir(this.filesystem['~'], '~');

        this.outputEl.lastChild.remove();

        if (results.length === 0) {
            this.printMuted('No matches found');
        } else {
            results.forEach(result => {
                this.print(`<span class="output-link" onclick="terminal.cmdCat(['${result}'])">${result}</span>`);
            });
            this.printMuted(`\n${results.length} match(es) found`);
        }
    }

    cmdWhoami() {
        this.print(`
<span class="output-ascii">aim</span>
<span class="output-muted">IT Professional (in the making)</span>
<span class="output-muted">Systems Optimization • Privacy Advocate</span>

<span class="output-info">Email:</span> amasud.tech@gmail.com
<span class="output-info">GitHub:</span> github.com/AIMDaAlien
<span class="output-info">Location:</span> Northern Virginia
`);
    }

    cmdNeofetch() {
        const logo = `
   ⣴⣶⣤⡤⠦⣤⣀⣤⠆     ⣈⣭⣭⣿⣶⣿⣦⣼⣆
    ⠉⠻⢿⣿⠿⣿⣿⣶⣦⠤⠶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠋
          ⠈⢿⣿⣟⠦ ⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡏
           ⣸⣿⣿⢧ ⢻⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
          ⢠⣿⣿⣿⠈  ⠁⠁⣿⣿⣿⣿⣿⣿⣿⣿
         ⢠⣿⣿⣿⠝       ⢿⣿⣿⣿⣿
        ⢸⣿⣿⣿⠁        ⢿⣿⣿⣿
       ⠁⢠⣿⣿⣿⠄          ⢈⣿⣿⣿
      ⢰⣿⣿⣿⠁           ⢸⣿⣿⣿⣿
`;

        this.print(`
<div class="neofetch-container">
<div class="neofetch-logo">${logo}</div>
<div class="neofetch-info">
<span><span class="neofetch-label">aim</span>@<span class="neofetch-label">garden</span></span>
<div class="neofetch-divider"></div>
<span><span class="neofetch-label">OS:</span> Knowledge Garden v2.0</span>
<span><span class="neofetch-label">Host:</span> First Portfolio Iteration</span>
<span><span class="neofetch-label">Kernel:</span> JavaScript ES2024</span>
<span><span class="neofetch-label">Uptime:</span> ${this.getUptime()}</span>
<span><span class="neofetch-label">Shell:</span> garden-terminal 1.0</span>
<span><span class="neofetch-label">Theme:</span> M3 Expressive [Lavender]</span>
<span><span class="neofetch-label">Terminal:</span> JetBrains Mono</span>
<span><span class="neofetch-label">Notes:</span> 70+</span>
<span><span class="neofetch-label">Projects:</span> 6 featured</span>

<div class="neofetch-colors">
<span class="neofetch-color" style="background: #7C3AED"></span>
<span class="neofetch-color" style="background: #E879F9"></span>
<span class="neofetch-color" style="background: #10B981"></span>
<span class="neofetch-color" style="background: #22D3EE"></span>
<span class="neofetch-color" style="background: #FBBF24"></span>
<span class="neofetch-color" style="background: #F87171"></span>
<span class="neofetch-color" style="background: #60A5FA"></span>
<span class="neofetch-color" style="background: #A7A9BE"></span>
</div>
</div>
</div>`);
    }

    cmdExit() {
        this.printSuccess('Returning to portfolio...');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    }

    // ============================================
    // FILESYSTEM UTILITIES
    // ============================================

    resolvePath(path) {
        if (!path) return null;

        // Normalize path
        path = path.replace(/\/+/g, '/').replace(/\/$/, '') || '~';

        const parts = path.split('/').filter(p => p);
        let current = this.filesystem;

        for (const part of parts) {
            if (current[part]) {
                current = current[part];
            } else if (current.children && current.children[part]) {
                current = current.children[part];
            } else {
                return null;
            }
        }

        return current;
    }

    countItems(node, type) {
        let count = 0;
        if (node.type === type) count++;
        if (node.children) {
            Object.values(node.children).forEach(child => {
                count += this.countItems(child, type);
            });
        }
        return count;
    }

    // ============================================
    // GITHUB INTEGRATION
    // ============================================

    async fetchNote(path) {
        if (this.noteCache.has(path)) {
            return this.noteCache.get(path);
        }

        const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/');
        const rawUrl = `https://raw.githubusercontent.com/${this.vaultOwner}/${this.vaultRepo}/${this.branch}/${encodedPath}`;

        const response = await fetch(rawUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
        }

        const content = await response.text();
        this.noteCache.set(path, content);
        return content;
    }

    renderMarkdown(content) {
        if (typeof marked === 'undefined') {
            return this.escapeHtml(content);
        }

        // Remove YAML frontmatter
        content = content.replace(/^---\n[\s\S]*?\n---\n/m, '');

        // Configure marked
        marked.setOptions({
            breaks: true,
            gfm: true
        });

        return marked.parse(content);
    }

    // ============================================
    // UI UTILITIES
    // ============================================

    updatePrompt() {
        this.promptPathEl.textContent = this.currentPath;
        this.statusPathEl.textContent = this.currentPath.replace('~', '~/knowledge-garden');
        this.titleEl.textContent = `aim@garden: ${this.currentPath}`;
    }

    updateTime() {
        const now = new Date();
        this.statusTimeEl.textContent = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getUptime() {
        const start = new Date('2025-01-01');
        const now = new Date();
        const diff = now - start;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${days} days, ${hours} hours`;
    }

    toggleMaximize() {
        this.terminalWindow.classList.toggle('maximized');
    }

    showWelcome() {
        const banner = `
<span class="output-ascii">╭─────────────────────────────────────────╮
│                                         │
│   <span style="color: var(--md-sys-color-primary)">Knowledge Garden</span> <span class="output-muted">v2.0</span>              │
│   <span class="output-muted">A terminal for browsing documentation</span> │
│                                         │
╰─────────────────────────────────────────╯</span>

<span class="output-muted">Welcome! Type '<span class="output-info">help</span>' to see available commands.</span>
<span class="output-muted">Try '<span class="output-info">ls</span>' to list files or '<span class="output-info">neofetch</span>' for system info.</span>
`;
        this.print(banner);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize terminal
const terminal = new KnowledgeGardenTerminal();
