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
        this.markedScriptUrl = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
        this.d3ScriptUrl = 'https://d3js.org/d3.v7.min.js';
        this.manifestCacheKey = `garden-manifest-cache:${this.vaultOwner}/${this.vaultRepo}/${this.branch}`;
        this.manifestCacheMaxAgeMs = 5 * 60 * 1000; // 5 minutes
        this.vaultSyncIntervalMs = 5 * 60 * 1000; // 5 minutes
        this.allowedScriptHosts = new Set(['cdn.jsdelivr.net', 'd3js.org']);

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

        // Featured project priority (most impressive first)
        // Notes matching these prefixes appear first, in this exact order
        this.featuredPriority = [
            'Projects/The Penthouse/',
            'Projects/Teardown Cafe/',
            'Projects/Archive/TrueNAS Build Guide.md',
            'Learning Journals/Privacy Hardening Journey.md',
            'Systems/Homelab/Prometheus Grafana Stack - Implementation Guide.md',
            'Learning Journals/3D Printing Optimization Journey.md',
            'Projects/Archive/Pi-hole Setup Guide - Complete Journey.md'
        ];

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
        this.manifestRevalidatePromise = null;
        this.vaultSyncTimer = null;
        this.lastManifestSyncAt = 0;
        this.lastFocusedElement = null;

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
        const sidebarToggle = document.getElementById('sidebarToggle');
        sidebarToggle.addEventListener('click', () => {
            this.sidebar.classList.toggle('collapsed');
            // On mobile, this opens the sidebar
            if (window.innerWidth <= 768) {
                this.sidebar.classList.add('open');
                sidebarToggle.setAttribute('aria-expanded', 'true');
                const overlay = document.getElementById('sidebarOverlay');
                overlay?.classList.add('visible');
                overlay?.setAttribute('aria-hidden', 'false');
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

        // Gallery toggle button on welcome page
        document.addEventListener('click', (e) => {
            if (e.target?.id === 'welcomeGalleryBtn') {
                this.loadCardGallery();
            }
        });

        document.addEventListener('keydown', (e) => {
            const card = e.target?.closest?.('.note-card');
            if (!card) return;
            if (card.tagName === 'BUTTON') return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const file = card.dataset.file;
                if (file) this.viewFileByPath(file);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const graphContainer = document.getElementById('graphContainer');
            if (!graphContainer || graphContainer.style.display === 'none') return;
            this.hideGraph();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            this.refreshManifestIfChanged({ silent: true }).catch(() => { });
        });

        // Update time
        this.updateTime();
        setInterval(() => this.updateTime(), 30000);

        // Load history
        const saved = localStorage.getItem('garden-history');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) this.commandHistory = parsed;
            } catch (error) {
                localStorage.removeItem('garden-history');
            }
        }

        // Load file tree from GitHub
        this.statusInfo.textContent = 'Loading vault...';
        await this.loadFileTree();

        // Load featured projects (published_to_garden=true, sorted by last_published)
        await this.loadFeaturedProjects();

        this.startVaultAutoSync();

        this.statusInfo.textContent = 'Ready';
    }

    startVaultAutoSync() {
        if (this.vaultSyncTimer) clearInterval(this.vaultSyncTimer);
        this.vaultSyncTimer = setInterval(() => {
            this.refreshManifestIfChanged({ silent: true }).catch(() => { });
        }, this.vaultSyncIntervalMs);
    }

    // ============================================
    // DYNAMIC FILE TREE
    // ============================================

    async loadFileTree() {
        this.fileTree.setAttribute('aria-busy', 'true');
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
                this.renderTreeError('Failed to load files');
            }
        } finally {
            this.fileTree.removeAttribute('aria-busy');
        }
    }

    renderTreeError(message) {
        this.fileTree.innerHTML = '';
        const error = document.createElement('div');
        error.className = 'tree-error';
        error.textContent = message;
        this.fileTree.appendChild(error);
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

            const itemEl = document.createElement('button');
            itemEl.type = 'button';
            itemEl.className = `tree-item ${isFolder ? 'folder' : 'file'}`;
            itemEl.style.paddingLeft = `${12 + depth * 16}px`;
            itemEl.setAttribute('role', 'treeitem');
            itemEl.setAttribute('tabindex', '0');
            itemEl.setAttribute('aria-selected', 'false');

            if (isFolder) {
                const chevron = document.createElement('span');
                chevron.className = 'tree-chevron';
                chevron.textContent = '\u25B6';
                itemEl.appendChild(chevron);
                itemEl.setAttribute('aria-expanded', 'false');
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
                childContainer.setAttribute('role', 'group');
                container.appendChild(childContainer);

                let loaded = false;

                itemEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isExpanded = !childContainer.classList.contains('collapsed');

                    if (!loaded) {
                        const children = this.buildTreeFromManifest(this.manifest, item.path);
                        childContainer.classList.remove('collapsed');
                        itemEl.classList.add('expanded');
                        itemEl.setAttribute('aria-expanded', 'true');
                        this.renderManifestTree(children, childContainer, depth + 1);
                        loaded = true;
                    } else {
                        childContainer.classList.toggle('collapsed');
                        itemEl.classList.toggle('expanded');
                        itemEl.setAttribute('aria-expanded', childContainer.classList.contains('collapsed') ? 'false' : 'true');
                    }
                });
                itemEl.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowRight' && childContainer.classList.contains('collapsed')) {
                        e.preventDefault();
                        itemEl.click();
                    } else if (e.key === 'ArrowLeft' && !childContainer.classList.contains('collapsed')) {
                        e.preventDefault();
                        itemEl.click();
                    }
                });
            } else {
                itemEl.addEventListener('click', () => {
                    this.viewFileByPath(item.path);
                    document.querySelectorAll('.tree-item').forEach(i => {
                        i.classList.remove('active');
                        i.setAttribute('aria-selected', 'false');
                    });
                    itemEl.classList.add('active');
                    itemEl.setAttribute('aria-selected', 'true');
                    this.closeMobileSidebar();
                });
            }
        });
    }

    // ============================================
    // FEATURED PROJECTS
    // ============================================

    isManifestStructureValid(manifest) {
        return !!manifest && typeof manifest === 'object' && Array.isArray(manifest.tree);
    }

    buildManifestVersion(manifest) {
        if (!this.isManifestStructureValid(manifest)) return null;
        if (manifest.generated_at) return String(manifest.generated_at);
        const metadataCount = Object.keys(manifest.metadata || {}).length;
        return `${manifest.tree.length}:${metadataCount}`;
    }

    getCachedManifest({ allowStale = false } = {}) {
        try {
            const raw = localStorage.getItem(this.manifestCacheKey);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            if (!this.isManifestStructureValid(parsed.manifest)) return null;

            const cachedAt = Number(parsed.cachedAt) || 0;
            const age = Date.now() - cachedAt;
            if (!allowStale && age > this.manifestCacheMaxAgeMs) return null;

            return parsed.manifest;
        } catch (error) {
            return null;
        }
    }

    setCachedManifest(manifest) {
        try {
            localStorage.setItem(this.manifestCacheKey, JSON.stringify({
                cachedAt: Date.now(),
                manifest
            }));
        } catch (error) {
            // Ignore storage failures (private mode/storage limits)
        }
    }

    async fetchManifestFromNetwork({ cacheBust = true } = {}) {
        const cacheParam = cacheBust ? `?v=${Date.now()}` : '';
        const url = `${this.rawBase}/garden-manifest.json${cacheParam}`;
        const manifest = await this.fetchJson(url, {
            timeoutMs: 12000,
            retries: 2,
            dedupeKey: `manifest:${this.vaultOwner}/${this.vaultRepo}/${this.branch}`
        });
        if (!this.isManifestStructureValid(manifest)) {
            throw new Error('Invalid garden manifest');
        }
        this.setCachedManifest(manifest);
        return manifest;
    }

    async applyFreshManifest(manifest, { rerender = false, statusMessage = '' } = {}) {
        if (!this.isManifestStructureValid(manifest)) return false;

        const currentVersion = this.buildManifestVersion(this.manifest);
        const nextVersion = this.buildManifestVersion(manifest);
        const changed = !currentVersion || currentVersion !== nextVersion;

        this.manifest = manifest;
        this.setCachedManifest(manifest);
        this.lastManifestSyncAt = Date.now();

        if (!changed) return false;

        this.treeCache.clear();
        this.noteCache.clear();
        this.gitTreeCache = null;

        if (rerender) {
            await this.loadFileTree();
            await this.loadFeaturedProjects();

            if (this.currentFile) {
                const fileStillExists = manifest.tree.some(e => e.path === this.currentFile && e.type === 'file');
                if (fileStillExists) {
                    await this.viewFileByPath(this.currentFile);
                } else {
                    this.showWelcome();
                }
            }
        }

        if (statusMessage) this.statusInfo.textContent = statusMessage;
        return true;
    }

    async revalidateManifest(expectedVersion) {
        const recentlySynced = Date.now() - this.lastManifestSyncAt < 60000;
        if (recentlySynced) return null;
        if (this.manifestRevalidatePromise) return this.manifestRevalidatePromise;

        this.manifestRevalidatePromise = (async () => {
            try {
                const freshManifest = await this.fetchManifestFromNetwork();
                const freshVersion = this.buildManifestVersion(freshManifest);
                if (!expectedVersion || freshVersion !== expectedVersion) {
                    await this.applyFreshManifest(freshManifest, {
                        rerender: true,
                        statusMessage: 'Vault updated'
                    });
                }
            } catch (error) {
                // Keep cached manifest if network revalidation fails
            } finally {
                this.manifestRevalidatePromise = null;
            }
        })();

        return this.manifestRevalidatePromise;
    }

    async fetchManifest() {
        if (this.manifest) {
            const expectedVersion = this.buildManifestVersion(this.manifest);
            this.revalidateManifest(expectedVersion).catch(() => { });
            return this.manifest;
        }

        const cachedManifest = this.getCachedManifest();
        if (cachedManifest) {
            this.manifest = cachedManifest;
            const expectedVersion = this.buildManifestVersion(cachedManifest);
            this.revalidateManifest(expectedVersion).catch(() => { });
            return this.manifest;
        }

        try {
            this.manifest = await this.fetchManifestFromNetwork();
            return this.manifest;
        } catch (error) {
            const staleManifest = this.getCachedManifest({ allowStale: true });
            if (staleManifest) {
                this.manifest = staleManifest;
                const expectedVersion = this.buildManifestVersion(staleManifest);
                this.revalidateManifest(expectedVersion).catch(() => { });
                return this.manifest;
            }
            throw error;
        }
    }

    async refreshManifestIfChanged({ manual = false, silent = false } = {}) {
        const previousStatus = this.statusInfo.textContent;
        if (!silent) this.statusInfo.textContent = 'Syncing vault...';

        try {
            const freshManifest = await this.fetchManifestFromNetwork();
            const changed = await this.applyFreshManifest(freshManifest, {
                rerender: true,
                statusMessage: silent ? '' : 'Vault synchronized'
            });

            if (!changed && !silent) this.statusInfo.textContent = 'Vault up to date';
            if (manual) {
                const message = changed ? 'Vault synchronized and refreshed.' : 'Vault is already up to date.';
                this.showOutput(`<span style="color:var(--terminal-green)">${message}</span>`);
            }
            if (silent && !changed) this.statusInfo.textContent = previousStatus;
            return changed;
        } catch (error) {
            if (!silent) this.statusInfo.textContent = 'Sync failed';
            if (manual) this.showOutput(`<span style="color:var(--terminal-red)">Sync failed: ${this.escapeHtml(error.message)}</span>`);
            return false;
        }
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
            const priority = this.getFeaturedPriorityScore(path);

            published.push({ path, title, published_to_garden: true, last_published: fm.last_published, created: fm.created, sortDate, priority });
        }

        // Sort: priority first (lower = better), then by date descending
        published.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return (b.sortDate || 0) - (a.sortDate || 0);
        });

        // Deduplicate by project prefix (only show one card per project folder)
        const seen = new Set();
        const deduped = [];
        for (const item of published) {
            // Use the first two path segments as the project key
            const Math_min_len = Math.min(item.path.split('/').length, 2);
            const projectKey = item.path.split('/').slice(0, Math_min_len).join('/');
            
            if (seen.has(projectKey)) continue;
            
            seen.add(projectKey);
            deduped.push(item);
            
            if (deduped.length >= 7) break;
        }

        return deduped;
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
            
            // Apply priority
            published.forEach(meta => {
                meta.priority = this.getFeaturedPriorityScore(meta.path);
            });
            
            published.sort((a, b) => {
                if (a.priority !== b.priority) return a.priority - b.priority;
                return (b.sortDate || 0) - (a.sortDate || 0);
            });

            // Deduplicate by project prefix
            const seen = new Set();
            const featured = [];
            for (const item of published) {
                const Math_min_len = Math.min(item.path.split('/').length, 2);
                const projectKey = item.path.split('/').slice(0, Math_min_len).join('/');
                
                if (seen.has(projectKey)) continue;
                
                seen.add(projectKey);
                featured.push(item);
                
                if (featured.length >= 7) break;
            }

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
        const data = await this.fetchJson(url, {
            timeoutMs: 12000,
            retries: 2
        });
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

    /**
     * Returns a priority score for a path.
     * Lower number = higher priority. Returns Infinity if not in priority list.
     */
    getFeaturedPriorityScore(path) {
        for (let i = 0; i < this.featuredPriority.length; i++) {
            const prefix = this.featuredPriority[i];
            if (path === prefix || path.startsWith(prefix)) return i;
        }
        return Infinity;
    }

    /**
     * Determines a consistent accent color for a project/note based on its path.
     */
    getProjectColor(path) {
        const topFolder = path.split('/')[0];
        
        // Check for specific sub-projects first
        if (path.includes('Teardown Cafe')) return 'var(--terminal-blue)';
        if (path.includes('The Penthouse')) return 'var(--terminal-magenta, #f5c2e7)';
        if (path.includes('TrueNAS')) return 'var(--terminal-green)';
        if (path.includes('Privacy Hardening')) return 'var(--terminal-yellow)';
        if (path.includes('Prometheus') || path.includes('Grafana')) return 'var(--terminal-cyan)';
        if (path.includes('3D Printing')) return 'var(--terminal-yellow)';
        if (path.includes('Pi-hole')) return 'var(--terminal-cyan)';
        if (path.includes('Router Configuration')) return 'var(--terminal-cyan)';
        
        // Fallback to top-level folder colors
        const categoryColors = {
            'Projects': 'var(--terminal-blue)',
            'Systems': 'var(--terminal-green)',
            'Learning Journals': 'var(--terminal-yellow)',
            'IT Projects': 'var(--terminal-cyan)',
            'Programming Concepts': 'var(--terminal-magenta, #f5c2e7)'
        };
        
        return categoryColors[topFolder] || 'var(--md-sys-color-primary)';
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
            const res = await this.fetchResponse(url, {}, {
                timeoutMs: 10000,
                retries: 1
            });
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

        // Category from path
        const pathParts = meta.path.split('/');
        const category = pathParts.length > 1 ? pathParts[1] : pathParts[0];
        const categoryDisplay = this.escapeHtml(category.replace(/\.md$/, ''));

        // Date display
        let dateHtml = '';
        const dateVal = meta.last_published || meta.created;
        if (dateVal) {
            const d = this.parseDate(dateVal);
            if (d) {
                const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                dateHtml = `<span class="note-card-date">Updated ${this.escapeHtml(formatted)}</span>`;
            }
        }

        const accentColor = this.getProjectColor(meta.path);

        return `
            <button type="button" class="note-card" data-file="${file}" aria-label="Open note: ${title}" style="--card-accent: ${accentColor}">
                <svg class="note-icon" style="fill: ${accentColor}">
                    <use href="icons-sprite.svg#icon-${iconKey}"></use>
                </svg>
                <div class="note-card-info">
                    <span class="note-title" style="color: ${accentColor}">${title}</span>
                    <span class="note-card-category" style="color: ${accentColor}; opacity: 0.8">${categoryDisplay}</span>
                    ${dateHtml}
                </div>
            </button>
        `;
    }

    async fetchDirectory(path) {
        const cacheKey = path || '_root';
        if (this.treeCache.has(cacheKey)) {
            return this.treeCache.get(cacheKey);
        }

        const encodedPath = path ? path.split('/').map(part => encodeURIComponent(part)).join('/') : '';
        const url = path ? `${this.apiBase}/${encodedPath}` : this.apiBase;
        const items = await this.fetchJson(url, {
            timeoutMs: 10000,
            retries: 2
        });

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

            const itemEl = document.createElement('button');
            itemEl.type = 'button';
            itemEl.className = `tree-item ${isFolder ? 'folder' : 'file'}`;
            itemEl.style.paddingLeft = `${12 + depth * 16}px`;
            itemEl.setAttribute('role', 'treeitem');
            itemEl.setAttribute('tabindex', '0');
            itemEl.setAttribute('aria-selected', 'false');

            // Chevron for folders
            if (isFolder) {
                const chevron = document.createElement('span');
                chevron.className = 'tree-chevron';
                chevron.textContent = '\u25B6';
                itemEl.appendChild(chevron);
                itemEl.setAttribute('aria-expanded', 'false');
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
                childContainer.setAttribute('role', 'group');
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
                        itemEl.setAttribute('aria-expanded', 'true');

                        try {
                            const children = await this.fetchDirectory(item.path);
                            childContainer.innerHTML = '';
                            this.renderTreeItems(children, childContainer, depth + 1);
                            loaded = true;
                        } catch (error) {
                            childContainer.innerHTML = '<div class="tree-error">Failed to load</div>';
                            itemEl.setAttribute('aria-expanded', 'false');
                        }
                    } else {
                        // Toggle visibility
                        childContainer.classList.toggle('collapsed');
                        itemEl.classList.toggle('expanded');
                        itemEl.setAttribute('aria-expanded', childContainer.classList.contains('collapsed') ? 'false' : 'true');
                    }
                });
                itemEl.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowRight' && childContainer.classList.contains('collapsed')) {
                        e.preventDefault();
                        itemEl.click();
                    } else if (e.key === 'ArrowLeft' && !childContainer.classList.contains('collapsed')) {
                        e.preventDefault();
                        itemEl.click();
                    }
                });
            } else {
                // File click
                itemEl.addEventListener('click', () => {
                    this.viewFileByPath(item.path);
                    document.querySelectorAll('.tree-item').forEach(i => {
                        i.classList.remove('active');
                        i.setAttribute('aria-selected', 'false');
                    });
                    itemEl.classList.add('active');
                    itemEl.setAttribute('aria-selected', 'true');
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
            await this.ensureMarkedLoaded();
            const html = this.renderMarkdown(content);

            // Build metadata bar from manifest
            let metaBarHtml = '';
            if (this.manifest && this.manifest.metadata) {
                const fm = this.manifest.metadata[githubPath];
                if (fm) {
                    const parts = [];
                    if (fm.created) {
                        const d = this.parseDate(fm.created);
                        if (d) parts.push(`<span class="meta-item">📅 Created: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>`);
                    }
                    if (fm.last_published) {
                        const d = this.parseDate(fm.last_published);
                        if (d) parts.push(`<span class="meta-item">🔄 Updated: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>`);
                    }
                    if (parts.length > 0) {
                        metaBarHtml = `<div class="note-metadata-bar">${parts.join('')}</div>`;
                    }
                }
            }

            this.contentBody.innerHTML = `${metaBarHtml}<div class="markdown-content">${html}</div>`;
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

    appendBreadcrumbButton(label, path) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'breadcrumb-item clickable';
        button.dataset.path = path;
        button.textContent = label;
        button.addEventListener('click', () => {
            if (!path) {
                this.showWelcome();
                this.loadFeaturedProjects();
            } else {
                this.showFolderContents(path);
            }
        });
        this.breadcrumb.appendChild(button);
    }

    updateBreadcrumb(path, { folderView = false } = {}) {
        const parts = path.split('/').filter(p => p);
        let cumPath = '';

        this.breadcrumb.innerHTML = '';
        this.appendBreadcrumbButton('~', '');

        parts.forEach((part, index) => {
            cumPath += (cumPath ? '/' : '') + part;
            const isFile = part.endsWith('.md');
            const displayName = part.replace('.md', '');
            const isCurrentFolder = folderView && index === parts.length - 1;

            if (isFile || isCurrentFolder) {
                const current = document.createElement('span');
                current.className = 'breadcrumb-item current';
                current.textContent = displayName;
                this.breadcrumb.appendChild(current);
            } else {
                this.appendBreadcrumbButton(displayName, cumPath);
            }
        });

        this.statusPath.textContent = `~/${path}`;
    }

    async showFolderContents(folderPath) {
        this.statusInfo.textContent = 'Loading folder...';

        try {
            const items = await this.fetchDirectory(folderPath);
            const folderView = document.createElement('div');
            folderView.className = 'folder-view';

            const heading = document.createElement('h2');
            heading.textContent = folderPath.split('/').pop() || 'Root';
            folderView.appendChild(heading);

            const folderItems = document.createElement('div');
            folderItems.className = 'folder-items';

            items.forEach(item => {
                const isFolder = item.type === 'dir';
                const displayName = item.name.replace('.md', '');
                const icon = isFolder ? 'storage' : 'book';
                const entry = document.createElement('button');
                entry.type = 'button';
                entry.className = `folder-item ${isFolder ? 'folder' : 'file'}`;
                entry.dataset.path = item.path;
                entry.dataset.type = item.type;
                entry.setAttribute('aria-label', `${isFolder ? 'Open folder' : 'Open file'} ${displayName}`);

                const iconEl = document.createElement('svg');
                iconEl.className = 'folder-item-icon';
                iconEl.setAttribute('aria-hidden', 'true');
                iconEl.innerHTML = `<use href="icons-sprite.svg#icon-${icon}"></use>`;

                const label = document.createElement('span');
                label.className = 'folder-item-name';
                label.textContent = displayName;

                entry.appendChild(iconEl);
                entry.appendChild(label);
                entry.addEventListener('click', () => {
                    if (item.type === 'dir') {
                        this.showFolderContents(item.path);
                    } else {
                        this.viewFileByPath(item.path);
                    }
                });

                folderItems.appendChild(entry);
            });

            folderView.appendChild(folderItems);
            this.contentBody.innerHTML = '';
            this.contentBody.appendChild(folderView);

            this.updateBreadcrumb(folderPath, { folderView: true });

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
        this.currentPath = '';
        this.contentBody.innerHTML = `
            <div class="welcome-content">
                <h1>Knowledge Garden</h1>
                <p class="muted">Select a file from the sidebar or use the terminal.</p>
                <div class="quick-start">
                    <h2>Quick Start</h2>
                    <ul>
                        <li>Click a file in the sidebar to view it</li>
                        <li>Use <code>cd folder</code> to navigate</li>
                        <li>Use <code>cat file.md</code> to view files</li>
                        <li>Use <code>ls</code> to list contents</li>
                    </ul>
                    <button type="button" class="gallery-toggle-btn" id="welcomeGalleryBtn" style="margin-top: 12px;">
                        📚 View All Notes as Cards
                    </button>
                </div>
                <div class="featured-notes">
                    <h2>Featured Projects</h2>
                    <div class="note-cards" id="featuredNotes"></div>
                </div>
            </div>`;
        this.breadcrumb.innerHTML = '';
        const root = document.createElement('span');
        root.className = 'breadcrumb-item';
        root.textContent = '~';
        this.breadcrumb.appendChild(root);
        this.statusPath.textContent = '~/';
        this.statusInfo.textContent = 'Ready';
    }

    closeMobileSidebar() {
        this.sidebar.classList.remove('open');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        sidebarOverlay?.classList.remove('visible');
        sidebarOverlay?.setAttribute('aria-hidden', 'true');
        document.getElementById('sidebarToggle')?.setAttribute('aria-expanded', 'false');
    }

    async fetchNote(path) {
        if (this.noteCache.has(path)) {
            return this.noteCache.get(path);
        }

        const encodedPath = path.split('/').map(part => encodeURIComponent(part)).join('/');
        const url = `${this.rawBase}/${encodedPath}`;

        const content = await this.fetchText(url, {
            timeoutMs: 10000,
            retries: 2
        });
        this.noteCache.set(path, content);
        return content;
    }

    renderMarkdown(content) {
        if (typeof marked === 'undefined') return this.escapeHtml(content);
        content = content.replace(/^---\n[\s\S]*?\n---\n/m, ''); // Remove frontmatter
        marked.setOptions({ breaks: true, gfm: true, headerIds: false, mangle: false });
        const rawHtml = marked.parse(content);
        return this.sanitizeRenderedHtml(rawHtml);
    }

    sanitizeRenderedHtml(html) {
        const template = document.createElement('template');
        template.innerHTML = html;

        const blockedTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'meta', 'link'];
        template.content.querySelectorAll(blockedTags.join(',')).forEach(el => el.remove());

        const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
        let node = walker.currentNode;

        while (node) {
            const attrs = Array.from(node.attributes || []);
            attrs.forEach(attr => {
                const name = attr.name.toLowerCase();
                const value = attr.value.trim();

                if (name.startsWith('on')) {
                    node.removeAttribute(attr.name);
                    return;
                }

                if (name === 'style') {
                    node.removeAttribute(attr.name);
                    return;
                }

                if (name === 'href' || name === 'src' || name === 'xlink:href') {
                    if (!this.isSafeUrl(value)) {
                        node.removeAttribute(attr.name);
                    }
                }
            });

            if (node.tagName && node.tagName.toLowerCase() === 'a') {
                const href = node.getAttribute('href');
                if (href && /^https?:\/\//i.test(href)) {
                    node.setAttribute('target', '_blank');
                    node.setAttribute('rel', 'noopener noreferrer');
                }
            }

            node = walker.nextNode();
        }

        return template.innerHTML;
    }

    isSafeUrl(value) {
        if (!value) return true;
        const lower = value.toLowerCase();
        if (lower.startsWith('javascript:')) return false;
        if (lower.startsWith('vbscript:')) return false;
        if (lower.startsWith('data:text/html')) return false;
        return true;
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
            if (input) {
                // Support pipe chaining
                if (input.includes('|')) {
                    this.executePipeline(input);
                } else {
                    this.executeCommand(input);
                }
            }
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
            const commands = ['cat', 'cd', 'clear', 'cowsay', 'date', 'echo', 'env', 'find', 'gallery', 'grep', 'head', 'help', 'history', 'ls', 'man', 'matrix', 'neofetch', 'open', 'pwd', 'sudo', 'sync', 'theme', 'tree', 'uname', 'wc', 'which', 'whoami'];
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
            const names = matches.map(m => {
                const display = m.type === 'dir' ? m.name + '/' : m.name;
                return this.escapeHtml(display);
            });
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
        try {
            localStorage.setItem('garden-history', JSON.stringify(this.commandHistory.slice(-50)));
        } catch (error) {
            // Ignore storage quota issues
        }

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

            case 'echo':
                this.executeEcho(args);
                break;

            case 'date':
                this.showOutput(`<span style="color:var(--terminal-cyan)">${new Date().toString()}</span>`);
                break;

            case 'wc':
                this.executeWc(args);
                break;

            case 'uname':
                if (args.includes('-a') || args.includes('--all')) {
                    this.showOutput('KnowledgeGarden 1.0 knowledge-garden aim WebTerminal');
                } else {
                    this.showOutput('KnowledgeGarden');
                }
                break;

            case 'env':
                this.showOutput(`<pre>USER=visitor
HOME=/home/visitor
PWD=~/${this.escapeHtml(this.currentPath)}
SHELL=/bin/garden-sh
TERM=xterm-256color
VAULT=${this.vaultOwner}/${this.vaultRepo}
BRANCH=${this.branch}
LANG=en_US.UTF-8</pre>`);
                break;

            case 'history':
                if (this.commandHistory.length === 0) {
                    this.showOutput('<span class="muted">No command history.</span>');
                } else {
                    const histLines = this.commandHistory.slice(-20).map((c, i) =>
                        `<span style="color:var(--terminal-cyan)">${String(i + 1).padStart(4)}</span>  ${this.escapeHtml(c)}`
                    );
                    this.showOutput('<pre>' + histLines.join('\n') + '</pre>');
                }
                break;

            case 'which':
                this.executeWhich(args);
                break;

            case 'touch':
            case 'rm':
            case 'mkdir':
            case 'mv':
            case 'cp':
            case 'chmod':
                this.showOutput(`<span style="color:var(--terminal-red)">${this.escapeHtml(cmd)}: Read-only vault. This is a web-based viewer.</span>`);
                break;

            case 'help':
                this.showOutput(`<b>Navigation:</b>
<span style="color:var(--terminal-cyan)">ls</span> [-l] [-a] [dir]   List directory contents
<span style="color:var(--terminal-cyan)">cd</span> [dir]             Change directory
<span style="color:var(--terminal-cyan)">pwd</span>                  Print working directory
<span style="color:var(--terminal-cyan)">tree</span> [dir]           Show directory tree

<b>File Viewing:</b>
<span style="color:var(--terminal-cyan)">cat</span> [file]           View a note (alias: open)
<span style="color:var(--terminal-cyan)">head</span> [-n N] [file]   Show first N lines of a note
<span style="color:var(--terminal-cyan)">wc</span> [file]            Count lines/words/chars

<b>Searching:</b>
<span style="color:var(--terminal-cyan)">find</span> [pattern]       Search file names
<span style="color:var(--terminal-cyan)">grep</span> [pattern]       Search file contents

<b>System:</b>
<span style="color:var(--terminal-cyan)">echo</span> [text]          Print text (supports $PWD, $USER, $HOME)
<span style="color:var(--terminal-cyan)">date</span>                 Print current date/time
<span style="color:var(--terminal-cyan)">uname</span> [-a]           System info
<span style="color:var(--terminal-cyan)">env</span>                  Show environment variables
<span style="color:var(--terminal-cyan)">history</span>              Show command history
<span style="color:var(--terminal-cyan)">which</span> [cmd]          Show if command exists
<span style="color:var(--terminal-cyan)">man</span> [cmd]            Show manual for command
<span style="color:var(--terminal-cyan)">theme</span> [dark|light]   Toggle theme
<span style="color:var(--terminal-cyan)">sync</span>                 Force vault refresh
<span style="color:var(--terminal-cyan)">clear</span>                Clear output
<span style="color:var(--terminal-cyan)">gallery</span>              Toggle card gallery view

<b>Fun:</b>
<span style="color:var(--terminal-cyan)">neofetch</span>             System splash
<span style="color:var(--terminal-cyan)">cowsay</span> [msg]         Moo
<span style="color:var(--terminal-cyan)">matrix</span>               Enter the matrix

<span class="muted">Tab completion supported. Pipe (|) supported for chaining commands.</span>`);
                break;

            case 'man':
                this.showManPage(args[0]);
                break;

            case 'theme':
                this.setTheme(args[0]);
                break;

            case 'sync':
                this.refreshManifestIfChanged({ manual: true, silent: false });
                break;

            case 'clear':
                this.terminalOutput.innerHTML = '';
                break;

            case 'gallery':
                this.toggleGalleryView();
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
                this.showOutput(`<span style="color:var(--terminal-red)">${this.escapeHtml(cmd)}: command not found</span>`);
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
            this.showOutput(`<span style="color:var(--terminal-red)">head: cannot read '${this.escapeHtml(filePath)}': ${this.escapeHtml(error.message)}</span>`);
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

    executeEcho(args) {
        // Simple env var expansion
        const envVars = {
            '$PWD': '~/' + this.currentPath,
            '$HOME': '~',
            '$USER': 'visitor',
            '$SHELL': '/bin/garden-sh',
            '$HOSTNAME': 'knowledge-garden'
        };

        let text = args.join(' ');
        for (const [key, val] of Object.entries(envVars)) {
            text = text.replaceAll(key, val);
        }
        this.showOutput(this.escapeHtml(text));
    }

    async executeWc(args) {
        if (args.length === 0) {
            this.showOutput('Usage: wc [filename]');
            return;
        }

        const filePath = this.resolveFilePath(args.join(' '));

        try {
            const content = await this.fetchNote(filePath);
            let body = content;
            if (body.startsWith('---')) {
                const end = body.indexOf('\n---', 3);
                if (end !== -1) body = body.slice(end + 4);
            }

            const lines = body.split('\n').length;
            const words = body.trim().split(/\s+/).filter(w => w.length > 0).length;
            const chars = body.length;
            const displayName = filePath.split('/').pop();

            this.showOutput(`<pre>  ${String(lines).padStart(6)}  ${String(words).padStart(6)}  ${String(chars).padStart(6)} ${this.escapeHtml(displayName)}</pre>`);
        } catch (error) {
            this.showOutput(`<span style="color:var(--terminal-red)">wc: ${this.escapeHtml(filePath)}: No such file</span>`);
        }
    }

    executeWhich(args) {
        const knownCommands = ['ls', 'cd', 'pwd', 'cat', 'open', 'head', 'find', 'grep', 'tree', 'echo', 'date', 'wc', 'uname', 'env', 'history', 'which', 'man', 'theme', 'sync', 'clear', 'gallery', 'neofetch', 'cowsay', 'matrix', 'whoami', 'help'];

        if (args.length === 0) {
            this.showOutput('Usage: which [command]');
            return;
        }

        const cmd = args[0].toLowerCase();
        if (knownCommands.includes(cmd)) {
            this.showOutput(`<span style="color:var(--terminal-green)">/usr/local/bin/${this.escapeHtml(cmd)}</span>`);
        } else {
            this.showOutput(`<span style="color:var(--terminal-red)">${this.escapeHtml(cmd)} not found</span>`);
        }
    }

    executePipeline(input) {
        // Add to command history
        this.commandHistory.push(input);
        this.historyIndex = this.commandHistory.length;
        try {
            localStorage.setItem('garden-history', JSON.stringify(this.commandHistory.slice(-50)));
        } catch (error) { }

        const stages = input.split('|').map(s => s.trim()).filter(s => s.length > 0);

        if (stages.length < 2) {
            this.executeCommand(input);
            return;
        }

        // Execute first command and capture its output
        const originalShowOutput = this.showOutput.bind(this);
        let capturedOutput = '';

        this.showOutput = (html) => {
            // Strip HTML tags to get plain text for piping
            const temp = document.createElement('div');
            temp.innerHTML = html;
            capturedOutput = temp.textContent || temp.innerText || '';
        };

        // Execute all but the last command
        for (let i = 0; i < stages.length - 1; i++) {
            capturedOutput = '';
            const [cmd, ...args] = stages[i].split(/\s+/);

            switch (cmd.toLowerCase()) {
                case 'ls': this.executeLs(args); break;
                case 'cat':
                    if (args[0]) {
                        const filePath = this.resolveFilePath(args.join(' '));
                        if (this.noteCache.has(filePath)) {
                            capturedOutput = this.noteCache.get(filePath);
                        }
                    }
                    break;
                case 'echo': capturedOutput = args.join(' '); break;
                case 'find': this.executeFind(args); break;
                case 'grep': this.executeGrep(args); break;
                case 'history':
                    capturedOutput = this.commandHistory.slice(-20).map((c, idx) => `${idx + 1}  ${c}`).join('\n');
                    break;
                default:
                    this.showOutput = originalShowOutput;
                    this.showOutput(`<span style="color:var(--terminal-red)">Pipe error: cannot pipe '${this.escapeHtml(cmd)}'</span>`);
                    return;
            }
        }

        // Restore showOutput for the final command
        this.showOutput = originalShowOutput;

        // Execute last command with piped input
        const [lastCmd, ...lastArgs] = stages[stages.length - 1].split(/\s+/);

        switch (lastCmd.toLowerCase()) {
            case 'wc': {
                const lines = capturedOutput.split('\n').length;
                const words = capturedOutput.trim().split(/\s+/).filter(w => w.length > 0).length;
                const chars = capturedOutput.length;
                this.showOutput(`<pre>  ${String(lines).padStart(6)}  ${String(words).padStart(6)}  ${String(chars).padStart(6)}</pre>`);
                break;
            }
            case 'head': {
                let n = 10;
                const headArgs = [...lastArgs];
                if (headArgs[0] === '-n' && headArgs[1]) {
                    n = parseInt(headArgs[1]) || 10;
                }
                const headLines = capturedOutput.split('\n').slice(0, n);
                this.showOutput('<pre>' + this.escapeHtml(headLines.join('\n')) + '</pre>');
                break;
            }
            case 'grep': {
                const pattern = lastArgs.join(' ').toLowerCase();
                const matchedLines = capturedOutput.split('\n').filter(l => l.toLowerCase().includes(pattern));
                if (matchedLines.length === 0) {
                    this.showOutput(`<span class="muted">No matches for '${this.escapeHtml(pattern)}'</span>`);
                } else {
                    this.showOutput('<pre>' + this.escapeHtml(matchedLines.join('\n')) + '</pre>');
                }
                break;
            }
            default:
                this.showOutput(`<span style="color:var(--terminal-red)">Pipe error: cannot pipe into '${this.escapeHtml(lastCmd)}'</span>`);
        }
    }

    // ============================================
    // CARD GALLERY VIEW
    // ============================================

    toggleGalleryView() {
        const isGalleryActive = document.querySelector('.gallery-view');
        if (isGalleryActive) {
            // Switch back to welcome/file view
            this.showWelcome();
            this.loadFeaturedProjects();
            this.showOutput('<span style="color:var(--terminal-green)">Switched to file browser view.</span>');
        } else {
            this.loadCardGallery();
            this.showOutput('<span style="color:var(--terminal-green)">Switched to gallery view.</span>');
        }
    }

    async loadCardGallery() {
        if (!this.manifest || !this.manifest.metadata) {
            this.contentBody.innerHTML = '<div class="muted">Loading gallery...</div>';
            return;
        }

        const metadata = this.manifest.metadata;
        const published = [];

        for (const [path, fm] of Object.entries(metadata)) {
            if (fm.published_to_garden !== true) continue;
            const parts = path.split('/');
            if (parts.some(p => this.hiddenItems.includes(p) || p.startsWith('.'))) continue;

            const title = fm.title || path.split('/').pop().replace(/\.md$/, '');
            const sortDate = this.parseDate(fm.last_published) || this.parseDate(fm.created);
            const priority = this.getFeaturedPriorityScore(path);

            published.push({ path, title, last_published: fm.last_published, created: fm.created, sortDate, priority });
        }

        // Sort by priority then date
        published.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return (b.sortDate || 0) - (a.sortDate || 0);
        });

        // Fetch description snippets for top cards (max 3 concurrent)
        const withSnippets = [];
        const batchSize = 6;
        for (let i = 0; i < published.length; i += batchSize) {
            const batch = published.slice(i, i + batchSize);
            const results = await Promise.all(batch.map(async (item) => {
                try {
                    const content = await this.fetchNote(item.path);
                    let body = content;
                    if (body.startsWith('---')) {
                        const end = body.indexOf('\n---', 3);
                        if (end !== -1) body = body.slice(end + 4);
                    }
                    // Remove markdown headers and get first meaningful text
                    body = body.replace(/^#+\s+.*$/gm, '').trim();
                    const snippet = body.slice(0, 150).replace(/\n/g, ' ').trim();
                    return { ...item, snippet: snippet ? snippet + '...' : '' };
                } catch (e) {
                    return { ...item, snippet: '' };
                }
            }));
            withSnippets.push(...results);
        }

        const cardsHtml = withSnippets.map(meta => this.renderGalleryCard(meta)).join('');

        this.contentBody.innerHTML = `
            <div class="gallery-view">
                <div class="gallery-header">
                    <h1>📚 Published Notes</h1>
                    <p class="muted">All published notes from the knowledge garden, sorted by importance.</p>
                    <button type="button" class="gallery-toggle-btn" id="galleryBackBtn">
                        ← Back to File Browser
                    </button>
                </div>
                <div class="gallery-grid">
                    ${cardsHtml}
                </div>
            </div>
        `;

        // Wire up back button
        document.getElementById('galleryBackBtn')?.addEventListener('click', () => {
            this.showWelcome();
            this.loadFeaturedProjects();
        });

        this.updateBreadcrumb('', { folderView: false });
        this.statusInfo.textContent = `${withSnippets.length} published notes`;
    }

    renderGalleryCard(meta) {
        const pathParts = meta.path.split('/');
        const category = pathParts.length > 1 ? pathParts[1] : pathParts[0];
        const categoryDisplay = this.escapeHtml(category.replace(/\.md$/, ''));
        const title = this.escapeHtml(meta.title);
        const file = this.escapeHtml(meta.path);
        const snippet = meta.snippet ? this.escapeHtml(meta.snippet) : '';

        const accentColor = this.getProjectColor(meta.path);

        let dateHtml = '';
        const dateVal = meta.last_published || meta.created;
        if (dateVal) {
            const d = this.parseDate(dateVal);
            if (d) {
                const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                dateHtml = `<span class="gallery-card-date">Updated ${this.escapeHtml(formatted)}</span>`;
            }
        }

        return `
            <button type="button" class="gallery-card note-card" data-file="${file}" aria-label="Open note: ${title}" style="--card-accent: ${accentColor}">
                <div class="gallery-card-header">
                    <span class="gallery-card-category" style="background: ${accentColor}20; color: ${accentColor}">${categoryDisplay}</span>
                    ${dateHtml}
                </div>
                <h3 class="gallery-card-title" style="color: ${accentColor}">${title}</h3>
                ${snippet ? `<p class="gallery-card-desc">${snippet}</p>` : ''}
            </button>
        `;
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
            sync: `<b>sync</b>
  Forces a vault sync and refreshes files/projects if changed.`,
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
        const safeMsg = this.escapeHtml(msg);
        const len = msg.length;
        const border = '_'.repeat(len + 2);
        this.showOutput(`<pre style="color:var(--terminal-yellow)">
 ${border}
< ${safeMsg} >
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

    async showGraph() {
        const graphContainer = document.getElementById('graphContainer');
        const graphCanvas = document.getElementById('graphCanvas');
        const closeButton = document.getElementById('closeGraphBtn');

        this.lastFocusedElement = document.activeElement;
        graphContainer.style.display = 'flex';
        graphContainer.setAttribute('aria-hidden', 'false');

        const d3Ready = await this.ensureD3Loaded();
        if (!d3Ready) {
            graphCanvas.innerHTML = '<div class="tree-error" style="padding: 20px;">Failed to load graph dependencies.</div>';
            return;
        }

        if (!window.graph) {
            window.graph = new KnowledgeGardenGraph();
            await window.graph.init('graphCanvas');
        }
        window.graph.show();
        closeButton?.focus();
    }

    hideGraph() {
        const graphContainer = document.getElementById('graphContainer');
        graphContainer.style.display = 'none';
        graphContainer.setAttribute('aria-hidden', 'true');
        window.graph?.hide();
        if (this.lastFocusedElement && this.lastFocusedElement.focus) {
            this.lastFocusedElement.focus();
        } else {
            document.getElementById('graphBtn')?.focus();
        }
    }

    // ============================================
    // UTILITIES
    // ============================================

    async ensureMarkedLoaded() {
        if (typeof window.marked !== 'undefined') return true;
        try {
            await this.loadExternalScript(this.markedScriptUrl);
            return typeof window.marked !== 'undefined';
        } catch (error) {
            console.error('Failed to load markdown parser:', error);
            return false;
        }
    }

    async ensureD3Loaded() {
        if (typeof window.d3 !== 'undefined') return true;
        try {
            await this.loadExternalScript(this.d3ScriptUrl);
            return typeof window.d3 !== 'undefined';
        } catch (error) {
            console.error('Failed to load D3:', error);
            return false;
        }
    }

    async loadExternalScript(src) {
        const url = new URL(src, window.location.href);
        if (!this.allowedScriptHosts.has(url.hostname)) {
            throw new Error(`Blocked external script host: ${url.hostname}`);
        }

        if (window.netUtils?.loadScriptOnce) {
            return window.netUtils.loadScriptOnce(src, { crossOrigin: 'anonymous' });
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }

    async fetchResponse(url, options = {}, policy = {}) {
        if (window.netUtils?.fetchWithRetry) {
            return window.netUtils.fetchWithRetry(url, options, policy);
        }
        return fetch(url, options);
    }

    async fetchJson(url, policy = {}) {
        if (window.netUtils?.fetchJson) {
            return window.netUtils.fetchJson(url, {}, policy);
        }
        const response = await this.fetchResponse(url, {}, policy);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    async fetchText(url, policy = {}) {
        if (window.netUtils?.fetchText) {
            return window.netUtils.fetchText(url, {}, policy);
        }
        const response = await this.fetchResponse(url, {}, policy);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
    }

    updateTime() {
        this.statusTime.textContent = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getFriendlyError(error, type = 'file') {
        const msg = String(error?.message || error || '').toLowerCase();

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
        div.textContent = String(text ?? '');
        return div.innerHTML;
    }
}

// Initialize and expose on window for graph access
const garden = new KnowledgeGarden();
window.garden = garden;
