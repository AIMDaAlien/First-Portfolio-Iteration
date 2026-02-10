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
            // Manifest tree failed, falling back to API
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
            // Manifest approach failed, falling back to per-file fetch
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
            // Fallback featured projects also failed
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
                chevron.textContent = '\u25B6';
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
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this.handleTabCompletion();
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

    handleTabCompletion() {
        const input = this.terminalInput.value;
        const parts = input.split(/\s+/);

        // If only one part, complete commands
        if (parts.length <= 1) {
            const partial = parts[0].toLowerCase();
            const commands = ['cat', 'cd', 'clear', 'cowsay', 'find', 'grep', 'head', 'help', 'ls', 'man', 'matrix', 'neofetch', 'open', 'pwd', 'sudo', 'theme', 'tree', 'whoami'];
            const matches = commands.filter(c => c.startsWith(partial));
            if (matches.length === 1) {
                this.terminalInput.value = matches[0] + ' ';
            } else if (matches.length > 1) {
                this.showOutput(matches.join('  '));
            }
            return;
        }

        // Complete file/folder names for the last argument
        const lastArg = parts[parts.length - 1];

        // Determine partial directory and prefix for completion
        let searchDir = this.currentPath;
        let partial = lastArg;

        // If the argument contains a slash, split into dir prefix and name partial
        const lastSlash = lastArg.lastIndexOf('/');
        if (lastSlash !== -1) {
            const dirPart = lastArg.substring(0, lastSlash);
            partial = lastArg.substring(lastSlash + 1);
            searchDir = this.resolvePath(dirPart);
        }

        if (!this.manifest) return;

        const entries = this.getManifestEntries(searchDir);
        const matches = entries.filter(e => e.name.toLowerCase().startsWith(partial.toLowerCase()));

        if (matches.length === 0) return;

        if (matches.length === 1) {
            const match = matches[0];
            const prefix = lastSlash !== -1 ? lastArg.substring(0, lastSlash + 1) : '';
            const completion = match.type === 'dir' ? match.name + '/' : match.name;
            parts[parts.length - 1] = prefix + completion;
            this.terminalInput.value = parts.join(' ');
        } else {
            // Show all matches
            const names = matches.map(m => m.type === 'dir' ? m.name + '/' : m.name);
            this.showOutput(names.join('  '));

            // Complete common prefix
            const commonPrefix = this.findCommonPrefix(matches.map(m => m.name));
            if (commonPrefix.length > partial.length) {
                const prefix = lastSlash !== -1 ? lastArg.substring(0, lastSlash + 1) : '';
                parts[parts.length - 1] = prefix + commonPrefix;
                this.terminalInput.value = parts.join(' ');
            }
        }
    }

    findCommonPrefix(strings) {
        if (strings.length === 0) return '';
        let prefix = strings[0];
        for (let i = 1; i < strings.length; i++) {
            while (!strings[i].toLowerCase().startsWith(prefix.toLowerCase())) {
                prefix = prefix.slice(0, -1);
                if (prefix === '') return '';
            }
        }
        return prefix;
    }

    navigateHistory(dir) {
        if (this.commandHistory.length === 0) return;
        this.historyIndex = Math.max(0, Math.min(this.commandHistory.length - 1, this.historyIndex + dir));
        this.terminalInput.value = this.commandHistory[this.historyIndex];
    }

    // ============================================
    // PATH RESOLUTION HELPERS
    // ============================================

    /**
     * Resolves a target path relative to this.currentPath.
     * Handles: '~' (root), '..' (parent), '.' (current), absolute paths, relative paths.
     * Returns the resolved path string with no leading or trailing slashes.
     */
    resolvePath(target) {
        if (!target || target === '~' || target === '/') return '';

        // Strip leading ~ or ~/
        if (target.startsWith('~/')) {
            target = target.substring(2);
        } else if (target === '~') {
            return '';
        }

        // If the target starts with / treat as absolute from vault root
        if (target.startsWith('/')) {
            target = target.substring(1);
        }

        // Build the starting segments from currentPath
        let segments;
        if (target.startsWith('/') || target === '') {
            segments = [];
        } else {
            segments = this.currentPath ? this.currentPath.split('/') : [];
        }

        const parts = target.split('/');
        for (const part of parts) {
            if (part === '' || part === '.') continue;
            if (part === '..') {
                segments.pop();
            } else {
                segments.push(part);
            }
        }

        return segments.join('/');
    }

    /**
     * Resolves a target to a file path.
     * If target ends with .md, use as-is via resolvePath.
     * Otherwise try target + '.md'.
     * Returns the resolved file path string.
     */
    resolveFilePath(target) {
        if (!target) return '';

        if (target.endsWith('.md')) {
            return this.resolvePath(target);
        }

        return this.resolvePath(target + '.md');
    }

    /**
     * Gets directory entries from the manifest for a given directory path.
     * Uses this.manifest.tree to find entries whose parent is dirPath.
     * Filters hidden items and only returns .md files for blobs.
     * Returns array of {name, path, type} sorted folders-first then alphabetically.
     */
    getManifestEntries(dirPath) {
        if (!this.manifest || !this.manifest.tree) return [];

        const entries = [];

        for (const entry of this.manifest.tree) {
            const parts = entry.path.split('/');
            const entryParent = parts.length > 1 ? parts.slice(0, -1).join('/') : '';

            if (entryParent !== dirPath) continue;

            const name = parts[parts.length - 1];

            // Filter hidden items
            if (this.hiddenItems.includes(name) || name.startsWith('.')) continue;

            // Only show .md files for blob/file types
            if (entry.type === 'file' && !name.endsWith('.md')) continue;

            entries.push({
                name: name,
                path: entry.path,
                type: entry.type === 'dir' ? 'dir' : 'file'
            });
        }

        // Sort: folders first, then files, alphabetically
        entries.sort((a, b) => {
            if (a.type === 'dir' && b.type !== 'dir') return -1;
            if (a.type !== 'dir' && b.type === 'dir') return 1;
            return a.name.localeCompare(b.name);
        });

        return entries;
    }

    // ============================================
    // COMMAND EXECUTION
    // ============================================

    executeCommand(input) {
        this.commandHistory.push(input);
        this.historyIndex = this.commandHistory.length;
        localStorage.setItem('garden-history', JSON.stringify(this.commandHistory.slice(-50)));

        const [cmd, ...args] = input.split(/\s+/);

        switch (cmd.toLowerCase()) {
            case 'cat':
            case 'open':
                if (args[0]) {
                    const filePath = this.resolveFilePath(args.join(' '));
                    this.viewFileByPath(filePath);
                } else {
                    this.showOutput('Usage: ' + cmd + ' [filename]');
                }
                break;

            case 'ls':
                this.executeLs(args);
                break;

            case 'cd':
                this.executeCd(args);
                break;

            case 'pwd':
                this.showOutput('<span style="color:var(--terminal-cyan)">~/' + this.escapeHtml(this.currentPath) + '</span>');
                break;

            case 'head':
                this.executeHead(args);
                break;

            case 'find':
                this.executeFind(args);
                break;

            case 'grep':
                this.executeGrep(args);
                break;

            case 'tree':
                this.executeTree(args);
                break;

            case 'help':
                this.showOutput(`<b>Commands:</b>
<span style="color:var(--terminal-cyan)">ls</span> [-l] [dir]       List directory contents
<span style="color:var(--terminal-cyan)">cd</span> [dir]            Change directory
<span style="color:var(--terminal-cyan)">pwd</span>                 Print working directory
<span style="color:var(--terminal-cyan)">cat</span> [file]          View a note (alias: open)
<span style="color:var(--terminal-cyan)">open</span> [file]         View a note (alias: cat)
<span style="color:var(--terminal-cyan)">head</span> [-n N] [file]  Show first N lines of a note
<span style="color:var(--terminal-cyan)">find</span> [pattern]      Search file names
<span style="color:var(--terminal-cyan)">grep</span> [pattern]      Search cached file contents
<span style="color:var(--terminal-cyan)">tree</span> [dir]          Show directory tree
<span style="color:var(--terminal-cyan)">man</span> [cmd]           Show manual for command
<span style="color:var(--terminal-cyan)">theme</span> [dark|light]  Toggle theme
<span style="color:var(--terminal-cyan)">clear</span>               Clear output
<span style="color:var(--terminal-cyan)">neofetch</span>            System info
<span style="color:var(--terminal-cyan)">cowsay</span> [msg]        Moo
<span style="color:var(--terminal-cyan)">matrix</span>              Enter the matrix

<span class="muted">Tab completion supported for commands and file names.</span>`);
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
                this.showOutput('<span style="color:var(--terminal-red)">Nice try!</span>');
                break;
            default:
                this.showOutput(`<span style="color:var(--terminal-red)">Unknown: ${this.escapeHtml(cmd)}</span>. Try 'help'`);
        }
    }

    // ============================================
    // TERMINAL COMMAND IMPLEMENTATIONS
    // ============================================

    executeLs(args) {
        if (!this.manifest) {
            this.showOutput('<span style="color:var(--terminal-red)">Manifest not loaded. Try again shortly.</span>');
            return;
        }

        let longFormat = false;
        let targetDir = this.currentPath;

        // Parse arguments
        const filteredArgs = [];
        for (const arg of args) {
            if (arg === '-l') {
                longFormat = true;
            } else if (arg === '-la' || arg === '-al') {
                longFormat = true;
            } else {
                filteredArgs.push(arg);
            }
        }

        if (filteredArgs.length > 0) {
            targetDir = this.resolvePath(filteredArgs.join(' '));
        }

        const entries = this.getManifestEntries(targetDir);

        if (entries.length === 0) {
            const dirExists = this.manifest.tree.some(e => e.path === targetDir && e.type === 'dir');
            if (!dirExists && targetDir !== '') {
                this.showOutput(`<span style="color:var(--terminal-red)">ls: no such directory: ${this.escapeHtml(targetDir)}</span>`);
                return;
            }
            this.showOutput('<span class="muted">(empty directory)</span>');
            return;
        }

        if (longFormat) {
            const lines = entries.map(e => {
                const typeIndicator = e.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--';
                const colorStyle = e.type === 'dir' ? 'color:var(--terminal-blue)' : 'color:var(--terminal-cyan)';
                const displayName = e.type === 'dir' ? e.name + '/' : e.name;
                return `${typeIndicator}  <span style="${colorStyle}">${this.escapeHtml(displayName)}</span>`;
            });
            this.showOutput('<pre>' + lines.join('\n') + '</pre>');
        } else {
            const items = entries.map(e => {
                const colorStyle = e.type === 'dir' ? 'color:var(--terminal-blue)' : 'color:var(--terminal-cyan)';
                const displayName = e.type === 'dir' ? e.name + '/' : e.name;
                return `<span style="${colorStyle}">${this.escapeHtml(displayName)}</span>`;
            });
            this.showOutput(items.join('  '));
        }
    }

    executeCd(args) {
        if (!this.manifest) {
            this.showOutput('<span style="color:var(--terminal-red)">Manifest not loaded. Try again shortly.</span>');
            return;
        }

        const target = args.join(' ') || '~';
        const resolved = this.resolvePath(target);

        // Root is always valid
        if (resolved === '') {
            this.currentPath = '';
            this.terminalPath.textContent = '~';
            return;
        }

        // Check if directory exists in manifest
        const dirExists = this.manifest.tree.some(e => e.path === resolved && e.type === 'dir');
        if (!dirExists) {
            this.showOutput(`<span style="color:var(--terminal-red)">cd: no such directory: ${this.escapeHtml(resolved)}</span>`);
            return;
        }

        this.currentPath = resolved;
        this.terminalPath.textContent = '~/' + resolved;
    }

    async executeHead(args) {
        let numLines = 10;
        let fileArgs = [];

        // Parse -n flag
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '-n' && i + 1 < args.length) {
                const n = parseInt(args[i + 1], 10);
                if (!isNaN(n) && n > 0) {
                    numLines = n;
                    i++; // skip next arg
                } else {
                    this.showOutput('<span style="color:var(--terminal-red)">head: invalid line count</span>');
                    return;
                }
            } else {
                fileArgs.push(args[i]);
            }
        }

        if (fileArgs.length === 0) {
            this.showOutput('Usage: head [-n N] [file]');
            return;
        }

        const filePath = this.resolveFilePath(fileArgs.join(' '));

        try {
            const content = await this.fetchNote(filePath);
            // Strip frontmatter for display
            let body = content;
            if (body.startsWith('---')) {
                const end = body.indexOf('\n---', 3);
                if (end !== -1) body = body.slice(end + 4).trimStart();
            }

            const lines = body.split('\n').slice(0, numLines);
            const displayName = filePath.split('/').pop();
            this.showOutput(
                `<span style="color:var(--terminal-cyan)">--- ${this.escapeHtml(displayName)} (first ${numLines} lines) ---</span>\n<pre>${this.escapeHtml(lines.join('\n'))}</pre>`
            );
        } catch (error) {
            this.showOutput(`<span style="color:var(--terminal-red)">head: cannot read '${this.escapeHtml(filePath)}': ${error.message}</span>`);
        }
    }

    executeFind(args) {
        if (!this.manifest) {
            this.showOutput('<span style="color:var(--terminal-red)">Manifest not loaded. Try again shortly.</span>');
            return;
        }

        if (args.length === 0) {
            this.showOutput('Usage: find [pattern]');
            return;
        }

        const pattern = args.join(' ').toLowerCase();
        const results = [];

        for (const entry of this.manifest.tree) {
            // Filter hidden
            const parts = entry.path.split('/');
            if (parts.some(p => this.hiddenItems.includes(p) || p.startsWith('.'))) continue;

            // Only .md files for file type
            if (entry.type === 'file' && !entry.path.endsWith('.md')) continue;

            // Match against file name
            const name = parts[parts.length - 1];
            if (name.toLowerCase().includes(pattern)) {
                results.push(entry);
            }

            if (results.length >= 20) break;
        }

        if (results.length === 0) {
            this.showOutput(`<span class="muted">No files matching '${this.escapeHtml(pattern)}'</span>`);
            return;
        }

        const lines = results.map(e => {
            const colorStyle = e.type === 'dir' ? 'color:var(--terminal-blue)' : 'color:var(--terminal-cyan)';
            return `<span style="${colorStyle}">${this.escapeHtml(e.path)}</span>`;
        });

        const suffix = results.length >= 20 ? '\n<span class="muted">(showing first 20 results)</span>' : '';
        this.showOutput(lines.join('\n') + suffix);
    }

    executeGrep(args) {
        if (args.length === 0) {
            this.showOutput('Usage: grep [pattern]');
            return;
        }

        const pattern = args.join(' ').toLowerCase();
        const results = [];

        for (const [path, content] of this.noteCache.entries()) {
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(pattern)) {
                    const displayLine = lines[i].trim();
                    // Highlight the match
                    const escaped = this.escapeHtml(displayLine);
                    const regex = new RegExp('(' + this.escapeHtml(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
                    const highlighted = escaped.replace(regex, '<b style="color:var(--terminal-yellow)">$1</b>');

                    results.push(
                        `<span style="color:var(--terminal-cyan)">${this.escapeHtml(path)}:${i + 1}</span>: ${highlighted}`
                    );

                    if (results.length >= 20) break;
                }
            }
            if (results.length >= 20) break;
        }

        if (results.length === 0) {
            this.showOutput(`<span class="muted">No matches for '${this.escapeHtml(pattern)}' in cached notes (${this.noteCache.size} files cached)</span>`);
            return;
        }

        const suffix = results.length >= 20 ? '\n<span class="muted">(showing first 20 results)</span>' : '';
        this.showOutput('<pre>' + results.join('\n') + suffix + '</pre>');
    }

    executeTree(args) {
        if (!this.manifest) {
            this.showOutput('<span style="color:var(--terminal-red)">Manifest not loaded. Try again shortly.</span>');
            return;
        }

        let targetDir = this.currentPath;
        if (args.length > 0) {
            targetDir = this.resolvePath(args.join(' '));
        }

        // Verify directory exists (root is always valid)
        if (targetDir !== '') {
            const dirExists = this.manifest.tree.some(e => e.path === targetDir && e.type === 'dir');
            if (!dirExists) {
                this.showOutput(`<span style="color:var(--terminal-red)">tree: no such directory: ${this.escapeHtml(targetDir)}</span>`);
                return;
            }
        }

        const displayRoot = targetDir || '~';
        const lines = [`<span style="color:var(--terminal-blue)">${this.escapeHtml(displayRoot)}</span>`];
        let fileCount = 0;
        let dirCount = 0;

        const buildTree = (dirPath, prefix, depth) => {
            if (depth > 3) return;

            const entries = this.getManifestEntries(dirPath);

            entries.forEach((entry, index) => {
                const isLast = index === entries.length - 1;
                const connector = isLast ? '\u2514\u2500\u2500 ' : '\u251C\u2500\u2500 ';
                const childPrefix = isLast ? '    ' : '\u2502   ';

                if (entry.type === 'dir') {
                    dirCount++;
                    lines.push(`${prefix}${connector}<span style="color:var(--terminal-blue)">${this.escapeHtml(entry.name)}/</span>`);
                    buildTree(entry.path, prefix + childPrefix, depth + 1);
                } else {
                    fileCount++;
                    const displayName = entry.name;
                    lines.push(`${prefix}${connector}<span style="color:var(--terminal-cyan)">${this.escapeHtml(displayName)}</span>`);
                }
            });
        };

        buildTree(targetDir, '', 0);
        lines.push('');
        lines.push(`<span class="muted">${dirCount} directories, ${fileCount} files</span>`);

        this.showOutput('<pre>' + lines.join('\n') + '</pre>');
    }

    showManPage(cmd) {
        const manPages = {
            open: `<b>open</b> [filename]
  Opens and displays a note from the vault.
  Resolves paths relative to current directory.
  Example: open Git.md
  Example: open ~/Projects/Portfolio.md`,
            cat: `<b>cat</b> [filename]
  Alias for 'open'. Displays file contents.
  Resolves paths relative to current directory.
  Example: cat README.md`,
            ls: `<b>ls</b> [-l] [directory]
  List directory contents using vault manifest.
  -l    Long format with type indicators
  Example: ls
  Example: ls -l Projects
  Example: ls ..`,
            cd: `<b>cd</b> [directory]
  Change the current working directory.
  Supports: .., ~, relative and absolute paths.
  Example: cd Projects
  Example: cd ..
  Example: cd ~/Systems/Homelab`,
            pwd: `<b>pwd</b>
  Print the current working directory path.`,
            head: `<b>head</b> [-n N] [filename]
  Show the first N lines of a note (default 10).
  Strips frontmatter before counting lines.
  Example: head README.md
  Example: head -n 5 Git.md`,
            find: `<b>find</b> [pattern]
  Search file names matching a pattern (case-insensitive).
  Searches the entire vault manifest.
  Shows up to 20 results.
  Example: find docker
  Example: find .md`,
            grep: `<b>grep</b> [pattern]
  Search cached file contents for a pattern.
  Only searches notes already viewed this session.
  Shows filename, line number, and matching line.
  Up to 20 results.
  Example: grep kubernetes
  Example: grep TODO`,
            tree: `<b>tree</b> [directory]
  Display a tree view of the directory structure.
  Uses the vault manifest. Depth limited to 3 levels.
  Example: tree
  Example: tree Projects`,
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
            this.showOutput(`No manual entry for '${this.escapeHtml(cmd)}'`);
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
              Shell: Periwinkle Zsh
  ____        Notes: ${this.noteCache?.size || '~300'}
 |    |       Theme: M3 Periwinkle Dark
 |____|       Terminal: Floating v2.0
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
