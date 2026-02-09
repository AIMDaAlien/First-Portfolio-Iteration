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
        this.gitTreeCache = null; // cached result of git/trees?recursive=1
        this.commandHistory = [];
        this.historyIndex = -1;

        // Hidden files/folders
        this.hiddenItems = ['.obsidian', '.stfolder', '.DS_Store', '.gitignore', '.github', 'Myself', 'images'];

        // Icon mapping by folder name
        this.iconMap = {
            'IT Projects': 'build',
            'Learning Journals': 'school',
            'Programming Concepts': 'code',
            'Projects': 'build',
            'Systems': 'computer',
            'default_folder': 'storage',
            'default_file': 'book'
        };

        // Cached manifest data
        this.manifest = null;

        // DOM Elements
        this.terminalInput = document.getElementById('terminalInput');
        this.terminalOutput = document.getElementById('terminalOutput');
        this.terminalPath = document.getElementById('terminalPath');
        this.floatingTerminal = document.getElementById('floatingTerminal');
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
        // Terminal input
        this.terminalInput.addEventListener('keydown', (e) => this.handleTerminalKey(e));

        // Terminal dragging
        this.initTerminalDrag();

        // Terminal controls
        document.getElementById('terminalMinimize')?.addEventListener('click', () => this.minimizeTerminal());
        document.getElementById('terminalMaximize')?.addEventListener('click', () => this.maximizeTerminal());

        // Sidebar toggle (desktop)
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            this.sidebar.classList.toggle('collapsed');
            // On mobile, this opens the sidebar
            if (window.innerWidth <= 768) {
                this.sidebar.classList.add('open');
                document.getElementById('sidebarOverlay')?.classList.add('visible');
            }
        });

        // Close sidebar when clicking overlay
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                this.closeMobileSidebar();
            });
        }

        // Graph button
        document.getElementById('graphBtn').addEventListener('click', () => this.showGraph());
        document.getElementById('closeGraphBtn')?.addEventListener('click', () => this.hideGraph());
        document.getElementById('animateBtn')?.addEventListener('click', () => window.graph?.animate());

        // Note card clicks (works for dynamically-rendered featured projects)
        document.addEventListener('click', (e) => {
            const card = e.target?.closest?.('.note-card');
            if (!card) return;
            const file = card.dataset.file;
            if (file) this.viewFileByPath(file);
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

        // Load featured projects (published_to_garden=true, sorted by last_published)
        await this.loadFeaturedProjects();

        this.statusInfo.textContent = 'Ready';
    }

    // ============================================
    // DYNAMIC FILE TREE
    // ============================================

    async loadFileTree() {
        try {
            // Try manifest-based tree first (0 API calls)
            const manifest = await this.fetchManifest();
            const items = this.buildTreeFromManifest(manifest, '');
            this.fileTree.innerHTML = '';
            this.renderManifestTree(items, this.fileTree, 0);
        } catch (error) {
            console.warn('Manifest tree failed, falling back to API:', error);
            try {
                const items = await this.fetchDirectory('');
                this.fileTree.innerHTML = '';
                this.renderTreeItems(items, this.fileTree, 0);
            } catch (fallbackError) {
                console.error('Failed to load file tree:', fallbackError);
                this.fileTree.innerHTML = '<div class="tree-error">Failed to load files</div>';
            }
        }
    }

    buildTreeFromManifest(manifest, parentPath) {
        const tree = manifest.tree || [];
        const items = [];

        for (const entry of tree) {
            const parts = entry.path.split('/');

            // Determine the parent of this entry
            const entryParent = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
            if (entryParent !== parentPath) continue;

            const name = parts[parts.length - 1];

            // Filter hidden items
            if (this.hiddenItems.includes(name) || name.startsWith('.')) continue;

            // Only show .md files (skip .base and other types)
            if (entry.type === 'file' && !name.endsWith('.md')) continue;

            items.push({
                name: name,
                path: entry.path,
                type: entry.type === 'dir' ? 'dir' : 'file'
            });
        }

        // Sort: folders first, then files, alphabetically
        items.sort((a, b) => {
            if (a.type === 'dir' && b.type !== 'dir') return -1;
            if (a.type !== 'dir' && b.type === 'dir') return 1;
            return a.name.localeCompare(b.name);
        });

        return items;
    }

    renderManifestTree(items, container, depth) {
        items.forEach(item => {
            const isFolder = item.type === 'dir';
            const displayName = item.name.replace('.md', '');
            const iconKey = this.iconMap[item.name] || (isFolder ? 'default_folder' : 'default_file');

            const itemEl = document.createElement('div');
            itemEl.className = `tree-item ${isFolder ? 'folder' : 'file'}`;
            itemEl.style.paddingLeft = `${12 + depth * 16}px`;

            if (isFolder) {
                const chevron = document.createElement('span');
                chevron.className = 'tree-chevron';
                chevron.textContent = '\u25B6';
                itemEl.appendChild(chevron);
            }

            const icon = document.createElement('svg');
            icon.className = 'tree-icon';
            icon.innerHTML = `<use href="icons-sprite.svg#icon-${iconKey}"></use>`;
            itemEl.appendChild(icon);

            const label = document.createElement('span');
            label.className = 'tree-label';
            label.textContent = displayName;
            itemEl.appendChild(label);

            container.appendChild(itemEl);

            if (isFolder) {
                const childContainer = document.createElement('div');
                childContainer.className = 'tree-children collapsed';
                container.appendChild(childContainer);

                let loaded = false;

                itemEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isExpanded = !childContainer.classList.contains('collapsed');

                    if (!loaded) {
                        const children = this.buildTreeFromManifest(this.manifest, item.path);
                        childContainer.classList.remove('collapsed');
                        itemEl.classList.add('expanded');
                        this.renderManifestTree(children, childContainer, depth + 1);
                        loaded = true;
                    } else {
                        childContainer.classList.toggle('collapsed');
                        itemEl.classList.toggle('expanded');
                    }
                });
            } else {
                itemEl.addEventListener('click', () => {
                    this.viewFileByPath(item.path);
                    document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
                    itemEl.classList.add('active');
                    this.closeMobileSidebar();
                });
            }
        });
    }

    // ============================================
    // FEATURED PROJECTS
    // ============================================

    async fetchManifest() {
        if (this.manifest) return this.manifest;

        const url = `${this.rawBase}/garden-manifest.json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Manifest fetch failed: HTTP ${res.status}`);
        this.manifest = await res.json();
        return this.manifest;
    }

    async loadFeaturedProjects() {
        const container = document.getElementById('featuredNotes');
        if (!container) return;

        container.setAttribute('aria-busy', 'true');

        try {
            // Try manifest-based approach first (1 request instead of 70+)
            const featured = await this.loadFeaturedFromManifest();

            if (featured.length === 0) {
                container.innerHTML = '<div class="muted">No featured projects found.</div>';
                return;
            }

            container.innerHTML = featured.map(meta => this.renderFeaturedCard(meta)).join('');

        } catch (error) {
            console.warn('Manifest approach failed, falling back to per-file fetch:', error);
            await this.loadFeaturedProjectsFallback(container);
        } finally {
            container.removeAttribute('aria-busy');
        }
    }

    async loadFeaturedFromManifest() {
        const manifest = await this.fetchManifest();
        const metadata = manifest.metadata || {};

        const published = [];
        for (const [path, fm] of Object.entries(metadata)) {
            if (fm.published_to_garden !== true) continue;
            if (!this.isCandidateFeaturedPath(path)) continue;

            const title = fm.title || path.split('/').pop().replace(/\.md$/, '');
            const sortDate = this.parseDate(fm.last_published) || this.parseDate(fm.created);

            published.push({ path, title, published_to_garden: true, last_published: fm.last_published, created: fm.created, sortDate });
        }

        published.sort((a, b) => (b.sortDate || 0) - (a.sortDate || 0));
        return published.slice(0, 6);
    }

    async loadFeaturedProjectsFallback(container) {
        try {
            const tree = await this.fetchGitTreeRecursive();

            const candidatePaths = (tree.tree || [])
                .filter(item => item.type === 'blob' && item.path.endsWith('.md'))
                .map(item => item.path)
                .filter(p => this.isCandidateFeaturedPath(p));

            const metas = await this.fetchFeaturedMetadata(candidatePaths.slice(0, 120));
            const published = metas.filter(m => m.published_to_garden === true);
            published.sort((a, b) => (b.sortDate || 0) - (a.sortDate || 0));

            const featured = published.slice(0, 6);

            if (featured.length === 0) {
                container.innerHTML = '<div class="muted">No featured projects found.</div>';
                return;
            }

            container.innerHTML = featured.map(meta => this.renderFeaturedCard(meta)).join('');
        } catch (error) {
            console.warn('Fallback featured projects also failed:', error);
        }
    }

    async fetchGitTreeRecursive() {
        if (this.gitTreeCache) return this.gitTreeCache;

        const url = `https://api.github.com/repos/${this.vaultOwner}/${this.vaultRepo}/git/trees/${this.branch}?recursive=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Tree fetch failed: HTTP ${res.status}`);
        const data = await res.json();
        this.gitTreeCache = data;
        return data;
    }

    isCandidateFeaturedPath(path) {
        // Never surface hidden/private areas
        const parts = path.split('/');
        if (parts.some(p => this.hiddenItems.includes(p) || p.startsWith('.'))) return false;

        // Only treat these as "project" content for the featured strip
        return (
            path.startsWith('Projects/') ||
            path.startsWith('Systems/Homelab/') ||
            path.startsWith('Systems/Router Configuration/') ||
            path.startsWith('Learning Journals/') ||
            path.startsWith('IT Projects/')
        );
    }

    async fetchFeaturedMetadata(paths) {
        const metas = [];

        // Fetch in small batches to reduce perceived latency
        const batchSize = 12;
        for (let i = 0; i < paths.length; i += batchSize) {
            const batch = paths.slice(i, i + batchSize);
            const results = await Promise.all(batch.map(p => this.fetchNoteFrontmatter(p)));
            for (const r of results) {
                if (r) metas.push(r);
            }
        }

        return metas;
    }

    async fetchNoteFrontmatter(path) {
        try {
            const encodedPath = path.split('/').map(s => encodeURIComponent(s)).join('/');
            const url = `${this.rawBase}/${encodedPath}`;
            const res = await fetch(url);
            if (!res.ok) return null;

            const text = await res.text();
            const fm = this.parseFrontmatter(text);

            // Title: use first H1 after frontmatter, else filename
            const title = this.extractTitle(text) || path.split('/').pop().replace(/\.md$/, '');

            const lastPublishedRaw = fm.last_published;
            const createdRaw = fm.created;

            const sortDate = this.parseDate(lastPublishedRaw) || this.parseDate(createdRaw);

            return {
                path,
                title,
                published_to_garden: fm.published_to_garden === true,
                last_published: lastPublishedRaw,
                created: createdRaw,
                sortDate
            };
        } catch (e) {
            return null;
        }
    }

    parseFrontmatter(mdText) {
        // Very small parser: supports the keys we care about.
        // Frontmatter must be the first block.
        if (!mdText.startsWith('---')) return {};
        const end = mdText.indexOf('\n---', 3);
        if (end === -1) return {};

        const block = mdText.slice(3, end).trim();
        const out = {};

        block.split('\n').forEach(line => {
            const m = line.match(/^([A-Za-z0-9_\-]+):\s*(.*)$/);
            if (!m) return;
            const key = m[1];
            let value = m[2].trim();

            // Strip quotes
            value = value.replace(/^['"]/, '').replace(/['"]$/, '');

            if (value === 'true') out[key] = true;
            else if (value === 'false') out[key] = false;
            else if (value === 'null') out[key] = null;
            else out[key] = value;
        });

        return out;
    }

    extractTitle(mdText) {
        // Remove frontmatter if present
        let body = mdText;
        if (body.startsWith('---')) {
            const end = body.indexOf('\n---', 3);
            if (end !== -1) body = body.slice(end + 4);
        }

        const m = body.match(/^\s*#\s+(.+)$/m);
        return m ? m[1].trim() : null;
    }

    parseDate(raw) {
        if (!raw) return null;
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    }

    renderFeaturedCard(meta) {
        const topFolder = meta.path.split('/')[0];
        const iconKey = this.iconMap[topFolder] || 'default_file';
        const title = this.escapeHtml(meta.title);
        const file = this.escapeHtml(meta.path);

        return `
            <div class="note-card" data-file="${file}">
                <svg class="note-icon">
                    <use href="icons-sprite.svg#icon-${iconKey}"></use>
                </svg>
                <span class="note-title">${title}</span>
            </div>
        `;
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
    // FLOATING TERMINAL
    // ============================================

    initTerminalDrag() {
        const terminal = this.floatingTerminal;
        const titlebar = document.getElementById('terminalTitlebar');
        let isDragging = false;
        let startX, startY, startLeft, startBottom;

        titlebar.addEventListener('mousedown', (e) => {
            if (e.target.closest('.terminal-btn')) return;
            isDragging = true;
            terminal.classList.add('dragging');
            startX = e.clientX;
            startY = e.clientY;
            const rect = terminal.getBoundingClientRect();
            startLeft = rect.left;
            startBottom = window.innerHeight - rect.bottom;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            terminal.style.left = `${startLeft + dx}px`;
            terminal.style.bottom = `${startBottom - dy}px`;
            terminal.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                terminal.classList.remove('dragging');
            }
        });
    }

    minimizeTerminal() {
        this.floatingTerminal.classList.toggle('minimized');
        this.floatingTerminal.classList.remove('maximized');
    }

    maximizeTerminal() {
        this.floatingTerminal.classList.toggle('maximized');
        this.floatingTerminal.classList.remove('minimized');
    }

    handleTerminalKey(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = this.terminalInput.value.trim();
            if (input) this.executeCommand(input);
            this.terminalInput.value = '';
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.navigateHistory(-1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.navigateHistory(1);
        } else if (e.key === 'Escape') {
            this.floatingTerminal.classList.add('minimized');
        }
    }

    navigateHistory(dir) {
        if (this.commandHistory.length === 0) return;
        this.historyIndex = Math.max(0, Math.min(this.commandHistory.length - 1, this.historyIndex + dir));
        this.terminalInput.value = this.commandHistory[this.historyIndex];
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
                this.showOutput(`<b>Commands:</b>
open [file] - View a note
man [cmd] - Show manual for command
theme [dark|light] - Toggle theme
clear - Clear output
neofetch - System info`);
                break;
            case 'man':
                this.showManPage(args[0]);
                break;
            case 'theme':
                this.setTheme(args[0]);
                break;
            case 'clear':
                this.terminalOutput.innerHTML = '';
                break;
            // Easter eggs
            case 'neofetch':
                this.showNeofetch();
                break;
            case 'cowsay':
                this.showCowsay(args.join(' ') || 'Moo!');
                break;
            case 'matrix':
                this.showMatrix();
                break;
            case 'whoami':
                this.showOutput('<span style="color:var(--terminal-green)">visitor@knowledge-garden</span>');
                break;
            case 'sudo':
                this.showOutput('<span style="color:var(--terminal-red)">Nice try! 🔒</span>');
                break;
            default:
                this.showOutput(`<span style="color:var(--terminal-red)">Unknown: ${cmd}</span>. Try 'help'`);
        }
    }

    showManPage(cmd) {
        const manPages = {
            open: `<b>open</b> [filename]
  Opens and displays a note from the vault.
  Example: open Technical/Git.md`,
            cat: `<b>cat</b> [filename]
  Alias for 'open'. Displays file contents.`,
            theme: `<b>theme</b> [dark|light]
  Switches the color scheme.
  Example: theme dark`,
            help: `<b>help</b>
  Shows available commands.`,
            clear: `<b>clear</b>
  Clears the terminal output.`,
            man: `<b>man</b> [command]
  Shows manual page for a command.
  Example: man open`
        };

        if (!cmd) {
            this.showOutput('Usage: man [command]<br>Available: ' + Object.keys(manPages).join(', '));
        } else if (manPages[cmd.toLowerCase()]) {
            this.showOutput(`<pre>${manPages[cmd.toLowerCase()]}</pre>`);
        } else {
            this.showOutput(`No manual entry for '${cmd}'`);
        }
    }

    setTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
            this.showOutput('Theme set to <b>light</b>');
        } else if (theme === 'dark') {
            document.body.classList.remove('light-theme');
            this.showOutput('Theme set to <b>dark</b>');
        } else {
            this.showOutput('Usage: theme [dark|light]');
        }
    }

    showNeofetch() {
        this.showOutput(`<pre style="color:var(--md-sys-color-primary)">
   /\\         visitor@knowledge-garden
  /  \\        -------------------------
 /    \\       OS: Knowledge Garden Web
/______\\      Kernel: D3.js Force Graph
              Shell: Catppuccin Zsh
  ____        Notes: ${this.noteCache?.size || '~300'}
 |    |       Theme: Mocha Lavender
 |____|       Terminal: Floating v1.0
</pre>`);
    }

    showCowsay(msg) {
        const len = msg.length;
        const border = '_'.repeat(len + 2);
        this.showOutput(`<pre style="color:var(--terminal-yellow)">
 ${border}
< ${msg} >
 ${'-'.repeat(len + 2)}
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||
</pre>`);
    }

    showMatrix() {
        const chars = 'アイウエオカキクケコサシスセソタチツテト01';
        let html = '<pre style="color:var(--terminal-green);line-height:1.2">';
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 40; j++) {
                html += chars[Math.floor(Math.random() * chars.length)];
            }
            html += '\n';
        }
        html += '</pre><span style="color:var(--terminal-green)">Wake up, Neo...</span>';
        this.showOutput(html);
    }

    showOutput(html) {
        this.terminalOutput.innerHTML = html;
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
