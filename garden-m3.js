// Material Design 3 Knowledge Garden - Streamlined Version
// Enhanced with Tag Filtering & Featured Sidebar

class ObsidianGarden {
    constructor() {
        // Repository Configuration
        this.vaultOwner = 'AIMDaAlien';
        this.vaultRepo = 'knowledge-garden-vault';
        this.branch = 'main';
        
        this.noteCache = new Map();
        this.searchIndex = [];
        this.currentNote = null;
        this.privateFolders = ['Career', 'Myself']; // Privacy protection
        this.allTags = new Set();
        this.activeTags = new Set();
        this.featuredNotes = [
            'GrapheneOS Migration Guide - Complete Documentation.md',
            'TrueNAS Build Guide.md',
            'Homelab/Pi-hole Setup Guide - Complete Journey.md',
            'WireGuard VPN Setup.md',
            'Projects/Budget SAS Drive NAS Build Guide.md'
        ];
        
        // Configure marked.js for better parsing
        this.configureMarked();
    }

    configureMarked() {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: true,
                mangle: false,
                sanitize: false,
                smartypants: true
            });
        } else {
            console.error('marked.js not loaded! Markdown parsing will fail.');
        }
    }

    async init() {
        this.showLoading();
        
        try {
            const structure = await this.fetchVaultStructure();
            this.buildEnhancedSidebar(structure);
            await this.loadNote('🗺️ Knowledge Base - Main Index.md');
            this.extractAllTags();
            this.renderTagFilter();
            
        } catch (error) {
            console.error('Initialization error:', error);
            document.getElementById('noteContent').innerHTML = `
                <h2>Error Loading Knowledge Garden</h2>
                <p>Unable to load the knowledge base. Please check:</p>
                <ul>
                    <li>Repository name: ${this.vaultOwner}/${this.vaultRepo}</li>
                    <li>Branch: ${this.branch}</li>
                    <li>Network connection</li>
                </ul>
                <p><strong>Error details:</strong> ${error.message}</p>
            `;
        } finally {
            this.hideLoading();
        }
    }

    async fetchVaultStructure() {
        const apiUrl = `https://api.github.com/repos/${this.vaultOwner}/${this.vaultRepo}/git/trees/${this.branch}?recursive=true`;
        
        console.log('Fetching vault structure from:', apiUrl);
        
        const response = await fetch(apiUrl, {
            headers: { 
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Obsidian-Garden'
            }
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`✓ GitHub API returned ${data.tree.length} total items`);
        
        const mdFiles = data.tree.filter(item => item.path.endsWith('.md'));
        console.log(`✓ Found ${mdFiles.length} markdown files`);
        
        return this.parseTreeStructure(data.tree);
    }

    parseTreeStructure(tree) {
        const structure = {};
        let totalFiles = 0;
        let skippedPrivate = 0;
        let skippedHidden = 0;
        let processed = 0;
        
        tree.forEach(item => {
            // Only process markdown files
            if (!item.path.endsWith('.md')) return;
            totalFiles++;
            
            const parts = item.path.split('/');
            const folder = parts.length > 1 ? parts[0] : 'Root';
            
            // Skip private folders
            if (this.privateFolders.includes(folder)) {
                skippedPrivate++;
                return;
            }
            
            // Skip hidden files and folders
            if (parts.some(part => part.startsWith('.'))) {
                skippedHidden++;
                return;
            }
            
            const fileName = parts[parts.length - 1].replace('.md', '');
            
            if (!structure[folder]) {
                structure[folder] = [];
            }
            
            structure[folder].push({
                name: fileName,
                path: item.path,
                size: item.size
            });
            
            // Add to search index
            this.searchIndex.push({
                name: fileName,
                path: item.path,
                folder: folder
            });
            
            processed++;
        });
        
        console.log('\n📊 Parse Summary:');
        console.log(`  Total .md files: ${totalFiles}`);
        console.log(`  Skipped (private): ${skippedPrivate}`);
        console.log(`  Skipped (hidden): ${skippedHidden}`);
        console.log(`  ✓ Processed: ${processed}`);
        console.log(`  ✓ SearchIndex size: ${this.searchIndex.length}`);
        
        return structure;
    }

    // ENHANCED SIDEBAR WITH FEATURED SECTION
    buildEnhancedSidebar(structure) {
        const sidebar = document.getElementById('folderStructure');
        sidebar.innerHTML = '';
        
        // Add Featured Section
        const featuredGroup = document.createElement('li');
        featuredGroup.className = 'folder-group featured-group expanded';
        
        const featuredHeader = document.createElement('div');
        featuredHeader.className = 'folder-header featured-header';
        featuredHeader.innerHTML = `
            <span class="folder-icon material-symbols-outlined">stars</span>
            <span>⭐ Featured Projects</span>
        `;
        
        const featuredList = document.createElement('ul');
        featuredList.className = 'notes-list featured-list';
        
        this.featuredNotes.forEach(notePath => {
            const noteInfo = this.searchIndex.find(n => n.path === notePath);
            if (noteInfo) {
                const item = document.createElement('li');
                item.className = 'note-item featured-note';
                item.innerHTML = `
                    <span class="material-symbols-outlined" style="font-size: 18px; color: #B388FF;">star</span>
                    <span>${noteInfo.name}</span>
                `;
                item.onclick = () => this.loadNote(noteInfo.path);
                featuredList.appendChild(item);
            }
        });
        
        featuredGroup.appendChild(featuredHeader);
        featuredGroup.appendChild(featuredList);
        sidebar.appendChild(featuredGroup);
        
        // Add divider
        const divider = document.createElement('div');
        divider.className = 'sidebar-divider';
        sidebar.appendChild(divider);
        
        // Sort folders alphabetically
        const sortedFolders = Object.keys(structure).sort();
        
        sortedFolders.forEach(folder => {
            const notes = structure[folder];
            
            const folderGroup = document.createElement('li');
            folderGroup.className = 'folder-group';
            
            const header = document.createElement('div');
            header.className = 'folder-header';
            header.innerHTML = `
                <span class="folder-icon material-symbols-outlined">chevron_right</span>
                <span>${folder === 'Root' ? '📁 Root Notes' : `📁 ${folder}`}</span>
            `;
            header.onclick = () => this.toggleFolder(folderGroup);
            
            const notesList = document.createElement('ul');
            notesList.className = 'notes-list';
            
            // Sort notes alphabetically
            notes.sort((a, b) => a.name.localeCompare(b.name));
            
            notes.forEach(note => {
                const item = document.createElement('li');
                item.className = 'note-item';
                item.innerHTML = `
                    <span class="material-symbols-outlined" style="font-size: 18px;">description</span>
                    <span>${note.name}</span>
                `;
                item.onclick = () => this.loadNote(note.path);
                notesList.appendChild(item);
            });
            
            folderGroup.appendChild(header);
            folderGroup.appendChild(notesList);
            sidebar.appendChild(folderGroup);
        });
    }

    // TAG EXTRACTION FROM NOTES
    async extractAllTags() {
        for (const note of this.searchIndex) {
            try {
                const content = await this.fetchNoteContent(note.path);
                const tags = this.extractTagsFromContent(content);
                tags.forEach(tag => this.allTags.add(tag));
            } catch (error) {
                console.warn(`Could not extract tags from ${note.path}`);
            }
        }
        console.log(`✓ Extracted ${this.allTags.size} unique tags`);
    }

    extractTagsFromContent(content) {
        const tagPattern = /#[a-zA-Z][a-zA-Z0-9_-]*/g;
        const matches = content.match(tagPattern) || [];
        return [...new Set(matches)];
    }

    async fetchNoteContent(path) {
        if (this.noteCache.has(path)) {
            return this.noteCache.get(path);
        }
        
        const rawUrl = `https://raw.githubusercontent.com/${this.vaultOwner}/${this.vaultRepo}/${this.branch}/${encodeURIComponent(path)}`;
        const response = await fetch(rawUrl);
        const content = await response.text();
        this.noteCache.set(path, content);
        return content;
    }

    // TAG FILTER RENDERING
    renderTagFilter() {
        const filterContainer = document.createElement('div');
        filterContainer.className = 'tag-filter-container';
        filterContainer.innerHTML = `
            <div class="tag-filter-header">
                <span class="material-symbols-outlined">filter_alt</span>
                <span>Filter by Tag</span>
            </div>
            <div class="tag-cloud" id="tagCloud"></div>
        `;
        
        const drawer = document.getElementById('navigationDrawer');
        drawer.insertBefore(filterContainer, drawer.querySelector('.folder-list'));
        
        const tagCloud = document.getElementById('tagCloud');
        const sortedTags = Array.from(this.allTags).sort();
        
        sortedTags.forEach(tag => {
            const tagBtn = document.createElement('button');
            tagBtn.className = 'tag-filter-btn';
            tagBtn.textContent = tag;
            tagBtn.onclick = () => this.toggleTagFilter(tag, tagBtn);
            tagCloud.appendChild(tagBtn);
        });
    }

    toggleTagFilter(tag, button) {
        if (this.activeTags.has(tag)) {
            this.activeTags.delete(tag);
            button.classList.remove('active');
        } else {
            this.activeTags.add(tag);
            button.classList.add('active');
        }
        
        this.applyTagFilter();
    }

    applyTagFilter() {
        const allNoteItems = document.querySelectorAll('.note-item:not(.featured-note)');
        
        if (this.activeTags.size === 0) {
            // Show all notes
            allNoteItems.forEach(item => item.style.display = '');
            return;
        }
        
        // Filter notes based on active tags
        allNoteItems.forEach(async (item) => {
            const noteText = item.textContent.trim();
            const noteInfo = this.searchIndex.find(n => n.name === noteText);
            
            if (noteInfo) {
                const content = await this.fetchNoteContent(noteInfo.path);
                const tags = this.extractTagsFromContent(content);
                const hasActiveTag = Array.from(this.activeTags).some(activeTag => tags.includes(activeTag));
                
                item.style.display = hasActiveTag ? '' : 'none';
            }
        });
    }

    toggleFolder(folderGroup) {
        folderGroup.classList.toggle('expanded');
    }

    async loadNote(path) {
        this.showLoading();
        
        try {
            const content = await this.fetchNoteContent(path);
            const html = this.parseMarkdown(content);
            document.getElementById('noteContent').innerHTML = html;
            
            this.updateBreadcrumb(path);
            this.setupInternalLinks();
            this.highlightActiveNote(path);
            this.currentNote = path;
            
        } catch (error) {
            console.error('Error loading note:', error);
            document.getElementById('noteContent').innerHTML = `
                <h2>Failed to Load Note</h2>
                <p>Could not load: <code>${path}</code></p>
                <p><strong>Error:</strong> ${error.message}</p>
                <button class="filled-tonal-button" onclick="garden.loadMainIndex()">Return to Home</button>
            `;
        } finally {
            this.hideLoading();
        }
    }

    parseMarkdown(content) {
        if (typeof marked === 'undefined') {
            return '<p><strong>Error:</strong> Markdown parser not loaded. Please refresh the page.</p>';
        }
        
        try {
            // Remove YAML frontmatter
            content = content.replace(/^---\n[\s\S]*?\n---\n/m, '');
            
            // Store wiki links for processing
            const wikiLinkDatabase = [];
            
            // Extract [[link|text]] format
            const wikiLinkPattern1 = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
            let match;
            while ((match = wikiLinkPattern1.exec(content)) !== null) {
                wikiLinkDatabase.push({
                    fullMatch: match[0],
                    link: match[1].trim(),
                    text: match[2].trim(),
                    html: `<a href="javascript:void(0)" class="note-link" data-link="${this.escapeHtml(match[1].trim())}">${this.escapeHtml(match[2].trim())}</a>`
                });
            }
            
            // Extract [[link]] format
            const wikiLinkPattern2 = /\[\[([^\]]+)\]\]/g;
            while ((match = wikiLinkPattern2.exec(content)) !== null) {
                const linkText = match[1].trim();
                if (!wikiLinkDatabase.some(item => item.fullMatch.includes(linkText))) {
                    wikiLinkDatabase.push({
                        fullMatch: match[0],
                        link: linkText,
                        text: linkText,
                        html: `<a href="javascript:void(0)" class="note-link" data-link="${this.escapeHtml(linkText)}">${this.escapeHtml(linkText)}</a>`
                    });
                }
            }
            
            // Convert Obsidian callouts
            content = content.replace(/^> \[!(\w+)\]\s*(.*)$/gm, (match, type, title) => {
                return `> **${type.toUpperCase()}${title ? ': ' + title : ''}**`;
            });
            
            // Process markdown
            let html = marked.parse(content);
            
            // Replace wiki links in HTML
            wikiLinkDatabase.sort((a, b) => b.fullMatch.length - a.fullMatch.length);
            wikiLinkDatabase.forEach(wikiLink => {
                html = html.split(wikiLink.fullMatch).join(wikiLink.html);
            });
            
            // Process Obsidian tags
            html = html.replace(/(^|\s|>)(#[a-zA-Z][a-zA-Z0-9_-]*)/g, (match, prefix, tag) => {
                return `${prefix}<span class="note-tag">${tag}</span>`;
            });
            
            return html;
            
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return `<p><strong>Error parsing markdown:</strong> ${error.message}</p>`;
        }
    }

    setupInternalLinks() {
        document.querySelectorAll('.note-link').forEach(link => {
            link.addEventListener('click', async () => {
                const notePath = link.dataset.link;
                const fullPath = await this.resolveNotePath(notePath);
                
                if (fullPath) {
                    this.loadNote(fullPath);
                } else {
                    alert(`Note not found: ${notePath}`);
                }
            });
        });
    }

    async resolveNotePath(partialPath) {
        const withMd = partialPath.endsWith('.md') ? partialPath : partialPath + '.md';
        
        let match = this.searchIndex.find(n => n.path === withMd);
        
        if (!match) {
            match = this.searchIndex.find(n => 
                n.name === partialPath || 
                n.name === partialPath.replace('.md', '')
            );
        }
        
        return match ? match.path : null;
    }

    updateBreadcrumb(path) {
        const parts = path.replace('.md', '').split('/');
        const breadcrumb = document.getElementById('breadcrumb');
        
        let breadcrumbHtml = '<span class="breadcrumb-link" onclick="garden.loadMainIndex()">Home</span>';
        
        if (parts.length > 1) {
            breadcrumbHtml += '<span class="breadcrumb-separator">›</span>';
            breadcrumbHtml += `<span class="breadcrumb-link">${parts[0]}</span>`;
        }
        
        if (parts.length > 1 || parts[0] !== '🗺️ Knowledge Base - Main Index') {
            breadcrumbHtml += '<span class="breadcrumb-separator">›</span>';
            breadcrumbHtml += `<span style="color: var(--md-sys-color-on-surface)">${parts[parts.length - 1]}</span>`;
        }
        
        breadcrumb.innerHTML = breadcrumbHtml;
    }

    highlightActiveNote(path) {
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.querySelectorAll('.note-item').forEach(item => {
            const noteText = item.textContent.trim();
            const noteName = path.split('/').pop().replace('.md', '');
            
            if (noteText === noteName) {
                item.classList.add('active');
                
                const folderGroup = item.closest('.folder-group');
                if (folderGroup && !folderGroup.classList.contains('expanded')) {
                    this.toggleFolder(folderGroup);
                }
            }
        });
    }

    loadMainIndex() {
        this.loadNote('🗺️ Knowledge Base - Main Index.md');
    }

    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'block';
    }

    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') {
            unsafe = String(unsafe || '');
        }
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    // Navigation Rail Functions
    showAllNotes() {
        let html = '<h1>📚 All Notes</h1>';
        
        const folders = {};
        this.searchIndex.forEach(note => {
            if (!folders[note.folder]) {
                folders[note.folder] = [];
            }
            folders[note.folder].push(note);
        });
        
        Object.keys(folders).sort().forEach(folder => {
            html += `<h2>📁 ${folder}</h2><ul>`;
            folders[folder].sort((a, b) => a.name.localeCompare(b.name)).forEach(note => {
                html += `<li><a href="javascript:void(0)" class="note-link" onclick="garden.loadNote('${note.path}')">${note.name}</a></li>`;
            });
            html += '</ul>';
        });
        
        document.getElementById('noteContent').innerHTML = html;
    }
    
    showRecentNotes() {
        const html = `
            <h1>🕒 Recent Notes</h1>
            <p>Recently accessed notes functionality coming soon.</p>
            <p>This will show your most recently viewed notes for quick access.</p>
        `;
        document.getElementById('noteContent').innerHTML = html;
    }
    
    showSearch() {
        const html = `
            <h1>🔍 Search Knowledge Garden</h1>
            <div style="max-width: 600px; margin: 2rem auto;">
                <input type="text" 
                       id="searchInput" 
                       placeholder="Search notes..." 
                       style="width: 100%; padding: 12px 16px; font-size: 16px; border: 2px solid var(--md-sys-color-outline); border-radius: 8px; background: var(--md-sys-color-surface-variant); color: var(--md-sys-color-on-surface);">
                <div id="searchResults" style="margin-top: 24px;"></div>
            </div>
        `;
        document.getElementById('noteContent').innerHTML = html;
        
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const results = this.searchIndex.filter(note => 
                note.name.toLowerCase().includes(query) || 
                note.folder.toLowerCase().includes(query)
            );
            
            let resultsHtml = '';
            if (query.length > 0) {
                if (results.length > 0) {
                    resultsHtml = `<p>Found ${results.length} result(s):</p><ul>`;
                    results.slice(0, 10).forEach(note => {
                        resultsHtml += `<li><a href="javascript:void(0)" onclick="garden.loadNote('${note.path}')" style="color: var(--md-sys-color-primary);">${note.name}</a> <small style="color: var(--md-sys-color-on-surface-variant);">in ${note.folder}</small></li>`;
                    });
                    resultsHtml += '</ul>';
                } else {
                    resultsHtml = '<p>No results found.</p>';
                }
            }
            document.getElementById('searchResults').innerHTML = resultsHtml;
        });
        
        searchInput.focus();
    }
}

// Initialize Garden
const garden = new ObsidianGarden();
document.addEventListener('DOMContentLoaded', () => {
    garden.init();
    
    // Navigation Rail Button Handlers
    document.querySelectorAll('.nav-destination').forEach(button => {
        button.addEventListener('click', () => {
            const destination = button.dataset.destination;
            
            document.querySelectorAll('.nav-destination').forEach(btn => {
                btn.classList.remove('active');
            });
            
            button.classList.add('active');
            
            switch(destination) {
                case 'notes':
                    garden.showAllNotes();
                    break;
                case 'recent':
                    garden.showRecentNotes();
                    break;
                case 'search':
                    garden.showSearch();
                    break;
            }
        });
    });
});
