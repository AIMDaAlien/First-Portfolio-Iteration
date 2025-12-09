/**
 * Knowledge Garden - Obsidian-Style Interface
 * Dynamically fetches file tree from GitHub API
 */

class KnowledgeGarden {
    constructor() {
        // GitHub Configuration - UPDATED REPO
        this.vaultOwner = 'AIMDaAlien';
        this.vaultRepo = 'Obsidian-Vault';
        this.branch = 'main';
        this.apiBase = `https://api.github.com/repos/${this.vaultOwner}/${this.vaultRepo}/contents`;
        this.rawBase = `https://raw.githubusercontent.com/${this.vaultOwner}/${this.vaultRepo}/${this.branch}`;

        // State
        this.currentPath = '';
        this.currentFile = null;
        this.noteCache = new Map();
        this.treeCache = new Map();
        this.commandHistory = [];
        this.historyIndex = -1;

        // Hidden files/folders
        this.hiddenItems = ['.obsidian', '.stfolder', '.DS_Store', '.gitignore', 'Myself', 'Business', 'images'];

        // Icon mapping by folder name
        this.iconMap = {
            'Business': 'groups',
            'Computer Related Stuff': 'computer',
            'IT Projects': 'build',
            'Learning': 'school',
            'Meta': 'badge',
            'Projects': 'build',
            'Router Configuration': 'router',
            'Sessions': 'memory',
            'Technical': 'code',
            'default_folder': 'storage',
            'default_file': 'book'
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

    async init() {
        // Spotlight input
        this.spotlightInput.addEventListener('keydown', (e) => this.handleSpotlightKey(e));
        this.spotlightInput.addEventListener('focus', () => this.spotlightOutput.style.display = 'none');

        // Sidebar toggle (desktop)
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            this.sidebar.classList.toggle('collapsed');
        });

        // Mobile menu button
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                this.sidebar.classList.add('open');
                sidebarOverlay?.classList.add('visible');
            });
        }

        // Close sidebar when clicking overlay
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                this.closeMobileSidebar();
            });
        }

        // Graph button
        document.getElementById('graphBtn').addEventListener('click', () => this.showGraph());
        document.getElementById('closeGraphBtn')?.addEventListener('click', () => this.hideGraph());
        document.getElementById('animateBtn')?.addEventListener('click', () => window.graph?.animate());

        // Note card clicks
        document.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', () => {
                const file = card.dataset.file;
                if (file) this.viewFileByPath(file);
            });
        });

        // Update time
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);

        // Load history
        const saved = localStorage.getItem('garden-history');
        if (saved) this.commandHistory = JSON.parse(saved);

        // Load file tree from GitHub
        this.statusInfo.textContent = 'Loading vault...';
        await this.loadFileTree();
        this.statusInfo.textContent = 'Ready';
    }

    // ============================================
    // DYNAMIC FILE TREE
    // ============================================

    async loadFileTree() {
        try {
            const items = await this.fetchDirectory('');
            this.fileTree.innerHTML = '';
            this.renderTreeItems(items, this.fileTree, 0);
        } catch (error) {
            console.error('Failed to load file tree:', error);
            this.fileTree.innerHTML = '<div class="tree-error">Failed to load files</div>';
        }
    }

    async fetchDirectory(path) {
        const cacheKey = path || '_root';
        if (this.treeCache.has(cacheKey)) {
            return this.treeCache.get(cacheKey);
        }

        const url = path ? `${this.apiBase}/${encodeURIComponent(path)}` : this.apiBase;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const items = await response.json();

        // Filter and sort
        const filtered = items.filter(item =>
            !this.hiddenItems.includes(item.name) &&
            !item.name.startsWith('.') &&
            (item.type === 'dir' || item.name.endsWith('.md'))
        );

        // Sort: folders first, then files, alphabetically
        filtered.sort((a, b) => {
            if (a.type === 'dir' && b.type !== 'dir') return -1;
            if (a.type !== 'dir' && b.type === 'dir') return 1;
            return a.name.localeCompare(b.name);
        });

        this.treeCache.set(cacheKey, filtered);
        return filtered;
    }

    renderTreeItems(items, container, depth) {
        items.forEach(item => {
            const isFolder = item.type === 'dir';
            const displayName = item.name.replace('.md', '');
            const iconKey = this.iconMap[item.name] || (isFolder ? 'default_folder' : 'default_file');

            const itemEl = document.createElement('div');
            itemEl.className = `tree-item ${isFolder ? 'folder' : 'file'}`;
            itemEl.style.paddingLeft = `${12 + depth * 16}px`;

            // Chevron for folders
            if (isFolder) {
                const chevron = document.createElement('span');
                chevron.className = 'tree-chevron';
                chevron.textContent = '▶';
                itemEl.appendChild(chevron);
            }

            // SVG icon
            const icon = document.createElement('svg');
            icon.className = 'tree-icon';
            icon.innerHTML = `<use href="icons-sprite.svg#icon-${iconKey}"></use>`;
            itemEl.appendChild(icon);

            // Label
            const label = document.createElement('span');
            label.className = 'tree-label';
            label.textContent = displayName;
            itemEl.appendChild(label);

            container.appendChild(itemEl);

            if (isFolder) {
                // Create children container
                const childContainer = document.createElement('div');
                childContainer.className = 'tree-children collapsed';
                container.appendChild(childContainer);

                let loaded = false;

                itemEl.addEventListener('click', async (e) => {
                    e.stopPropagation();

                    const isExpanded = !childContainer.classList.contains('collapsed');

                    if (!loaded) {
                        // Load children on first expand
                        const loader = document.createElement('div');
                        loader.className = 'tree-loading';
                        loader.textContent = 'Loading...';
                        childContainer.appendChild(loader);
                        childContainer.classList.remove('collapsed');
                        itemEl.classList.add('expanded');

                        try {
                            const children = await this.fetchDirectory(item.path);
                            childContainer.innerHTML = '';
                            this.renderTreeItems(children, childContainer, depth + 1);
                            loaded = true;
                        } catch (error) {
                            childContainer.innerHTML = '<div class="tree-error">Failed to load</div>';
                        }
                    } else {
                        // Toggle visibility
                        childContainer.classList.toggle('collapsed');
                        itemEl.classList.toggle('expanded');
                    }
                });
            } else {
                // File click
                itemEl.addEventListener('click', () => {
                    this.viewFileByPath(item.path);
                    document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
                    itemEl.classList.add('active');
                    // Auto-close sidebar on mobile
                    this.closeMobileSidebar();
                });
            }
        });
    }

    // ============================================
    // CONTENT VIEWER
    // ============================================

    async viewFileByPath(githubPath) {
        this.currentFile = githubPath;
        this.updateBreadcrumb(githubPath);
        this.statusInfo.textContent = 'Loading...';

        try {
            const content = await this.fetchNote(githubPath);
            const html = this.renderMarkdown(content);

            this.contentBody.innerHTML = `<div class="markdown-content">${html}</div>`;
            const lineCount = content.split('\n').length;
            this.statusInfo.textContent = `${lineCount} lines`;
        } catch (error) {
            console.error('Fetch error:', error);
            const friendlyMessage = this.getFriendlyError(error, 'file');
            this.contentBody.innerHTML = `<div class="error-content">
                <h2>Couldn't load this note</h2>
                <p class="muted">${friendlyMessage}</p>
            </div>`;
            this.statusInfo.textContent = 'Not found';
        }
    }

    updateBreadcrumb(path) {
        const parts = path.split('/').filter(p => p);
        let cumPath = '';

        // Build clickable breadcrumb
        let html = '<span class="breadcrumb-item clickable" data-path="">~</span>';
        parts.forEach((part, i) => {
            cumPath += (cumPath ? '/' : '') + part;
            const isFile = part.endsWith('.md');
            const displayName = part.replace('.md', '');

            if (isFile) {
                html += `<span class="breadcrumb-item current">${displayName}</span>`;
            } else {
                html += `<span class="breadcrumb-item clickable" data-path="${cumPath}">${displayName}</span>`;
            }
        });

        this.breadcrumb.innerHTML = html;
        this.statusPath.textContent = `~/${path}`;

        // Add click handlers
        this.breadcrumb.querySelectorAll('.breadcrumb-item.clickable').forEach(item => {
            item.addEventListener('click', () => {
                const targetPath = item.dataset.path;
                if (!targetPath) {
                    this.showWelcome();
                } else {
                    this.showFolderContents(targetPath);
                }
            });
        });
    }

    async showFolderContents(folderPath) {
        this.statusInfo.textContent = 'Loading folder...';

        try {
            const items = await this.fetchDirectory(folderPath);

            // Build folder view HTML
            let html = `<div class="folder-view">
                <h2>${folderPath.split('/').pop()}</h2>
                <div class="folder-items">`;

            items.forEach(item => {
                const isFolder = item.type === 'dir';
                const displayName = item.name.replace('.md', '');
                const icon = isFolder ? 'storage' : 'book';

                html += `<div class="folder-item ${isFolder ? 'folder' : 'file'}" data-path="${item.path}" data-type="${item.type}">
                    <svg class="folder-item-icon"><use href="icons-sprite.svg#icon-${icon}"></use></svg>
                    <span class="folder-item-name">${displayName}</span>
                </div>`;
            });

            html += `</div></div>`;
            this.contentBody.innerHTML = html;

            // Update breadcrumb for folder view
            const parts = folderPath.split('/');
            let cumPath = '';
            let breadcrumbHtml = '<span class="breadcrumb-item clickable" data-path="">~</span>';
            parts.forEach(part => {
                cumPath += (cumPath ? '/' : '') + part;
                breadcrumbHtml += `<span class="breadcrumb-item clickable" data-path="${cumPath}">${part}</span>`;
            });
            this.breadcrumb.innerHTML = breadcrumbHtml;

            // Re-attach breadcrumb handlers
            this.breadcrumb.querySelectorAll('.breadcrumb-item.clickable').forEach(item => {
                item.addEventListener('click', () => {
                    const targetPath = item.dataset.path;
                    if (!targetPath) {
                        this.showWelcome();
                    } else {
                        this.showFolderContents(targetPath);
                    }
                });
            });

            // Add click handlers to folder items
            this.contentBody.querySelectorAll('.folder-item').forEach(item => {
                item.addEventListener('click', () => {
                    const path = item.dataset.path;
                    const type = item.dataset.type;
                    if (type === 'dir') {
                        this.showFolderContents(path);
                    } else {
                        this.viewFileByPath(path);
                    }
                });
            });

            this.statusInfo.textContent = `${items.length} items`;

        } catch (error) {
            console.error('Folder error:', error);
            const friendlyMessage = this.getFriendlyError(error, 'folder');
            this.contentBody.innerHTML = `<div class="error-content">
                <h2>Couldn't load folder</h2>
                <p class="muted">${friendlyMessage}</p>
            </div>`;
            this.statusInfo.textContent = 'Not found';
        }
    }

    showWelcome() {
        this.currentFile = null;
        this.contentBody.innerHTML = `
            <div class="welcome-content">
                <h1>Knowledge Garden</h1>
                <p class="muted">Select a file from the sidebar or use the spotlight.</p>
            </div>`;
        this.breadcrumb.innerHTML = '<span class="breadcrumb-item">~</span>';
        this.statusInfo.textContent = 'Ready';
    }

    closeMobileSidebar() {
        this.sidebar.classList.remove('open');
        document.getElementById('sidebarOverlay')?.classList.remove('visible');
    }

    async fetchNote(path) {
        if (this.noteCache.has(path)) {
            return this.noteCache.get(path);
        }

        const encodedPath = path.split('/').map(part => encodeURIComponent(part)).join('/');
        const url = `${this.rawBase}/${encodedPath}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

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
            case 'cat':
            case 'open':
                if (args[0]) this.viewFileByPath(args.join(' '));
                break;
            case 'help':
                this.showOutput(`<b>open [file]</b> view note  <b>help</b> show this`);
                break;
            case 'clear':
                this.spotlightOutput.style.display = 'none';
                this.spotlightOutput.innerHTML = '';
                break;
            default:
                this.showOutput(`Unknown: ${cmd}. Try 'help'`);
        }
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

    getFriendlyError(error, type = 'file') {
        const msg = error.message.toLowerCase();

        if (msg.includes('404')) {
            return type === 'folder'
                ? 'This folder may have been moved or renamed.'
                : 'This note may have been moved or renamed.';
        }
        if (msg.includes('403') || msg.includes('rate')) {
            return 'Too many requests. Please wait a moment and try again.';
        }
        if (msg.includes('network') || msg.includes('fetch')) {
            return 'Network issue. Check your connection and try again.';
        }
        return 'Something went wrong. Try refreshing the page.';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize and expose on window for graph access
const garden = new KnowledgeGarden();
window.garden = garden;
