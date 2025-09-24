// Material Design 3 Knowledge Garden - Fixed Markdown Parser
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
            this.buildSidebar(structure);
            await this.loadNote('🗺️ Knowledge Base - Main Index.md');
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
        return this.parseTreeStructure(data.tree);
    }

    parseTreeStructure(tree) {
        const structure = {};
        
        tree.forEach(item => {
            // Only process markdown files
            if (!item.path.endsWith('.md')) return;
            
            const parts = item.path.split('/');
            const folder = parts.length > 1 ? parts[0] : 'Root';
            
            // Skip private folders
            if (this.privateFolders.includes(folder)) return;
            
            // Skip hidden files and folders
            if (parts.some(part => part.startsWith('.'))) return;
            
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
        });
        
        return structure;
    }

    buildSidebar(structure) {
        const sidebar = document.getElementById('folderStructure');
        sidebar.innerHTML = '';
        
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

    toggleFolder(folderGroup) {
        folderGroup.classList.toggle('expanded');
    }

    async loadNote(path) {
        this.showLoading();
        
        try {
            let content;
            
            // Check cache first
            if (this.noteCache.has(path)) {
                content = this.noteCache.get(path);
            } else {
                const rawUrl = `https://raw.githubusercontent.com/${this.vaultOwner}/${this.vaultRepo}/${this.branch}/${encodeURIComponent(path)}`;
                
                const response = await fetch(rawUrl);
                
                if (!response.ok) {
                    throw new Error(`Note not found: ${response.status}`);
                }
                
                content = await response.text();
                this.noteCache.set(path, content);
            }
            
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
            
            // Preprocess: Convert Obsidian wiki links to HTML with data attributes
            // This happens BEFORE marked parses, avoiding renderer issues
            // Format: [[link|text]] -> special marker that we'll convert after marked
            content = content.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (match, link, text) => {
                return `<span class="wiki-link-marker" data-link="${link}">${text}</span>`;
            });
            // Format: [[link]] -> special marker
            content = content.replace(/\[\[([^\]]+)\]\]/g, (match, link) => {
                return `<span class="wiki-link-marker" data-link="${link}">${link}</span>`;
            });
            
            // Preprocess: Convert Obsidian tags to styled spans
            // Format: #tag -> <span class="note-tag">#tag</span>
            content = content.replace(/(^|\s)(#[a-zA-Z][a-zA-Z0-9_-]*)/g, (match, space, tag) => {
                return `${space}<span class="note-tag">${tag}</span>`;
            });
            
            // Convert Obsidian callouts to blockquotes
            content = content.replace(/^> \[!(\w+)\]\s*(.*)$/gm, (match, type, title) => {
                return `> **${type.toUpperCase()}${title ? ': ' + title : ''}**`;
            });
            
            // Parse with marked.js (no custom renderer needed)
            let html = marked.parse(content);
            
            // Post-process: Convert wiki-link-markers to actual clickable links
            html = html.replace(/<span class="wiki-link-marker" data-link="([^"]+)">([^<]+)<\/span>/g, 
                (match, link, text) => {
                    return `<a href="javascript:void(0)" class="note-link" data-link="${link}">${text}</a>`;
                }
            );
            
            return html;
            
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return `<p><strong>Error parsing markdown:</strong> ${error.message}</p><pre>${this.escapeHtml(content)}</pre>`;
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
        // Add .md extension if missing
        const withMd = partialPath.endsWith('.md') ? partialPath : partialPath + '.md';
        
        // Search in index for exact path match
        let match = this.searchIndex.find(n => n.path === withMd);
        
        // If not found, try matching by name only
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
        // Remove active class from all notes
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to current note
        document.querySelectorAll('.note-item').forEach(item => {
            const noteText = item.textContent.trim();
            const noteName = path.split('/').pop().replace('.md', '');
            
            if (noteText === noteName) {
                item.classList.add('active');
                
                // Expand parent folder
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
        // Ensure input is a string
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
    
    showAllNotes() {
        /**Display all available notes in a categorized list**/
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
                html += `<li><a href="javascript:void(0)" class="note-link" data-link="${note.path}" onclick="garden.loadNote('${note.path}')">${note.name}</a></li>`;
            });
            html += '</ul>';
        });
        
        document.getElementById('noteContent').innerHTML = html;
    }
    
    showRecentNotes() {
        /**Display recently accessed notes**/
        const html = `
            <h1>🕒 Recent Notes</h1>
            <p>Recently accessed notes functionality coming soon.</p>
            <p>This will show your most recently viewed notes for quick access.</p>
        `;
        document.getElementById('noteContent').innerHTML = html;
    }
    
    showSearch() {
        /**Display search interface**/
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
        
        // Add search functionality
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
            
            // Remove active state from all buttons
            document.querySelectorAll('.nav-destination').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Add active state to clicked button
            button.classList.add('active');
            
            // Handle navigation
            switch(destination) {
                case 'notes':
                    // Show all notes functionality
                    garden.showAllNotes();
                    break;
                case 'recent':
                    // Show recent notes functionality
                    garden.showRecentNotes();
                    break;
                case 'search':
                    // Show search functionality
                    garden.showSearch();
                    break;
            }
        });
    });
});
