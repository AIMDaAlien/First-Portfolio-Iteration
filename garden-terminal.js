/**
 * Knowledge Garden - Obsidian-Style Interface
 * Spotlight terminal + Sidebar + Content Viewer
 */

class KnowledgeGarden {
    constructor() {
        // GitHub Configuration
        this.vaultOwner = 'AIMDaAlien';
        this.vaultRepo = 'knowledge-garden-vault';
        this.branch = 'main';

        // State
        this.currentPath = '~';
        this.currentFile = null;
        this.noteCache = new Map();
        this.commandHistory = [];
        this.historyIndex = -1;

        // Virtual Filesystem
        this.filesystem = {
            '~': {
                type: 'dir',
                name: 'knowledge-garden',
                children: {
                    'featured': {
                        type: 'dir',
                        name: 'featured',
                        expanded: true,
                        children: {
                            'grapheneos-migration.md': { type: 'file', path: 'GrapheneOS Migration Guide - Complete Documentation.md', name: 'GrapheneOS Migration' },
                            'truenas-build.md': { type: 'file', path: 'TrueNAS Build Guide.md', name: 'TrueNAS Build' },
                            'pihole-setup.md': { type: 'file', path: 'Homelab/Pi-hole Setup Guide - Complete Journey.md', name: 'Pi-hole Setup' },
                            'wireguard-vpn.md': { type: 'file', path: 'WireGuard VPN Setup.md', name: 'WireGuard VPN' }
                        }
                    },
                    'projects': {
                        type: 'dir',
                        name: 'projects',
                        children: {
                            'budget-nas.md': { type: 'file', path: 'Projects/Budget SAS Drive NAS Build Guide.md', name: 'Budget NAS Build' }
                        }
                    },
                    'homelab': {
                        type: 'dir',
                        name: 'homelab',
                        children: {
                            'router-optimization.md': { type: 'file', path: 'Router/Optimization Guide.md', name: 'Router Optimization' }
                        }
                    },
                    'README.md': { type: 'file', path: '🗺️ Knowledge Base - Main Index.md', name: 'README' }
                }
            }
        };

        // DOM Elements
        this.spotlightInput = document.getElementById('spotlightInput');
        this.spotlightOutput = document.getElementById('spotlightOutput');
        this.spotlightPath = document.getElementById('spotlightPath');
        this.fileTree = document.getElementById('fileTree');
        this.contentBody = document.getElementById('contentBody');
        this.breadcrumb = document.getElementById('breadcrumb');
        this.statusPath = document.getElementById('statusPath');
        this.statusInfo = document.getElementById('statusInfo');
        this.statusTime = document.getElementById('statusTime');
        this.sidebar = document.getElementById('sidebar');

        this.init();
    }

    init() {
        // Spotlight input
        this.spotlightInput.addEventListener('keydown', (e) => this.handleSpotlightKey(e));
        this.spotlightInput.addEventListener('focus', () => this.spotlightOutput.style.display = 'none');

        // Render file tree
        this.renderFileTree();

        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            this.sidebar.classList.toggle('collapsed');
        });

        // Graph button
        document.getElementById('graphBtn').addEventListener('click', () => this.showGraph());
        document.getElementById('closeGraphBtn')?.addEventListener('click', () => this.hideGraph());
        document.getElementById('animateBtn')?.addEventListener('click', () => window.graph?.animate());

        // Note card clicks
        document.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', () => {
                const file = card.dataset.file;
                if (file) this.viewFile(file);
            });
        });

        // Update time
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);

        // Load history
        const saved = localStorage.getItem('garden-history');
        if (saved) this.commandHistory = JSON.parse(saved);
    }

    // ============================================
    // FILE TREE
    // ============================================

    renderFileTree() {
        this.fileTree.innerHTML = '';
        this.renderTreeNode(this.filesystem['~'], '~', this.fileTree);
    }

    renderTreeNode(node, path, container) {
        if (node.type === 'dir' && node.children) {
            Object.entries(node.children).forEach(([name, child]) => {
                const item = document.createElement('div');
                item.className = `tree-item ${child.type}`;

                const icon = document.createElement('span');
                icon.className = 'tree-icon';

                const label = document.createElement('span');
                label.textContent = child.name || name;

                item.appendChild(icon);
                item.appendChild(label);
                container.appendChild(item);

                const childPath = path === '~' ? `~/${name}` : `${path}/${name}`;

                if (child.type === 'dir') {
                    const childContainer = document.createElement('div');
                    childContainer.className = `tree-children ${child.expanded ? '' : 'collapsed'}`;
                    container.appendChild(childContainer);

                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        child.expanded = !child.expanded;
                        childContainer.classList.toggle('collapsed');
                    });

                    this.renderTreeNode(child, childPath, childContainer);
                } else {
                    item.addEventListener('click', () => {
                        this.viewFile(childPath);
                        document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                    });
                }
            });
        }
    }

    // ============================================
    // CONTENT VIEWER
    // ============================================

    async viewFile(filePath) {
        const file = this.resolveFile(filePath);
        if (!file || file.type === 'dir') {
            this.showNotification('File not found');
            return;
        }

        this.currentFile = filePath;
        this.updateBreadcrumb(filePath);
        this.statusInfo.textContent = 'Loading...';

        try {
            const content = await this.fetchNote(file.path);
            const html = this.renderMarkdown(content);

            this.contentBody.innerHTML = `<div class="markdown-content">${html}</div>`;
            this.statusInfo.textContent = `${content.split('\n').length} lines`;
        } catch (error) {
            this.contentBody.innerHTML = `<div class="error-content">
                <h2>Error loading file</h2>
                <p>${error.message}</p>
            </div>`;
            this.statusInfo.textContent = 'Error';
        }
    }

    resolveFile(path) {
        const parts = path.replace(/^~\/?/, '').split('/').filter(p => p);
        let current = this.filesystem['~'];

        for (const part of parts) {
            if (current.children && current.children[part]) {
                current = current.children[part];
            } else {
                return null;
            }
        }
        return current;
    }

    updateBreadcrumb(path) {
        const parts = path.split('/').filter(p => p);
        this.breadcrumb.innerHTML = parts.map(p =>
            `<span class="breadcrumb-item">${p}</span>`
        ).join('');
        this.statusPath.textContent = path.replace('~', '~/knowledge-garden');
    }

    async fetchNote(path) {
        if (this.noteCache.has(path)) {
            return this.noteCache.get(path);
        }

        const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/');
        const url = `https://raw.githubusercontent.com/${this.vaultOwner}/${this.vaultRepo}/${this.branch}/${encodedPath}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

        const content = await response.text();
        this.noteCache.set(path, content);
        return content;
    }

    renderMarkdown(content) {
        if (typeof marked === 'undefined') return this.escapeHtml(content);
        content = content.replace(/^---\n[\s\S]*?\n---\n/m, ''); // Remove frontmatter
        marked.setOptions({ breaks: true, gfm: true });
        return marked.parse(content);
    }

    // ============================================
    // SPOTLIGHT TERMINAL
    // ============================================

    handleSpotlightKey(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = this.spotlightInput.value.trim();
            if (input) this.executeCommand(input);
            this.spotlightInput.value = '';
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.navigateHistory(-1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.navigateHistory(1);
        } else if (e.key === 'Escape') {
            this.spotlightOutput.style.display = 'none';
        }
    }

    navigateHistory(dir) {
        if (this.commandHistory.length === 0) return;
        this.historyIndex = Math.max(0, Math.min(this.commandHistory.length - 1, this.historyIndex + dir));
        this.spotlightInput.value = this.commandHistory[this.historyIndex];
    }

    executeCommand(input) {
        this.commandHistory.push(input);
        this.historyIndex = this.commandHistory.length;
        localStorage.setItem('garden-history', JSON.stringify(this.commandHistory.slice(-50)));

        const [cmd, ...args] = input.split(/\s+/);

        switch (cmd.toLowerCase()) {
            case 'cd':
                this.cmdCd(args);
                break;
            case 'cat':
                if (args[0]) this.viewFile(this.resolvePath(args[0]));
                break;
            case 'ls':
                this.cmdLs(args);
                break;
            case 'help':
                this.cmdHelp();
                break;
            case 'clear':
                this.spotlightOutput.style.display = 'none';
                this.spotlightOutput.innerHTML = '';
                break;
            default:
                this.showOutput(`Command not found: ${cmd}. Try 'help'`);
        }
    }

    cmdCd(args) {
        const target = args[0] || '~';
        const newPath = this.resolvePath(target);
        const node = this.resolveFile(newPath);

        if (!node) {
            this.showOutput(`cd: no such directory: ${target}`);
            return;
        }
        if (node.type !== 'dir') {
            this.showOutput(`cd: not a directory: ${target}`);
            return;
        }

        this.currentPath = newPath;
        this.spotlightPath.textContent = newPath;
        this.statusPath.textContent = newPath.replace('~', '~/knowledge-garden');
    }

    cmdLs(args) {
        const path = args[0] ? this.resolvePath(args[0]) : this.currentPath;
        const node = this.resolveFile(path);

        if (!node || node.type !== 'dir') {
            this.showOutput(`ls: cannot access '${path}'`);
            return;
        }

        const items = Object.entries(node.children || {}).map(([name, item]) => {
            const isDir = item.type === 'dir';
            return `<span style="color: ${isDir ? 'var(--terminal-blue)' : 'inherit'}">${name}</span>`;
        });

        this.showOutput(items.join('  '));
    }

    cmdHelp() {
        this.showOutput(`
<strong>Commands:</strong>
  ls       List files
  cd       Change directory
  cat      View file
  clear    Clear output
  help     Show this help
        `.trim());
    }

    resolvePath(target) {
        if (target.startsWith('~') || target.startsWith('/')) return target;
        if (target === '..') {
            const parts = this.currentPath.split('/');
            parts.pop();
            return parts.length === 0 ? '~' : parts.join('/');
        }
        return this.currentPath === '~' ? `~/${target}` : `${this.currentPath}/${target}`;
    }

    showOutput(html) {
        this.spotlightOutput.innerHTML = html;
        this.spotlightOutput.style.display = 'block';
    }

    // ============================================
    // GRAPH VIEW
    // ============================================

    showGraph() {
        document.getElementById('graphContainer').style.display = 'flex';
        if (!window.graph) {
            window.graph = new KnowledgeGardenGraph();
            window.graph.init('graphCanvas');
        }
        window.graph.show();
    }

    hideGraph() {
        document.getElementById('graphContainer').style.display = 'none';
        window.graph?.hide();
    }

    // ============================================
    // UTILITIES
    // ============================================

    updateTime() {
        this.statusTime.textContent = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showNotification(msg) {
        this.statusInfo.textContent = msg;
        setTimeout(() => this.statusInfo.textContent = 'Ready', 2000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize
const garden = new KnowledgeGarden();
