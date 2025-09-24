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
        console.log('\n📁 Folder breakdown:');
        Object.entries(structure).forEach(([folder, files]) => {
            console.log(`  ${folder}: ${files.length} files`);
        });
        console.log('');
        
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
    
    // Graph View Implementation
    async buildGraphData() {
        /**Build comprehensive graph data from ALL vault notes with progress tracking**/
        const nodes = [];
        const links = [];
        const nodeMap = new Map();
        const linkCounts = new Map();
        
        // Access loading bar elements directly each time
        const showProgress = (percentage) => {
            const bar = document.getElementById('graphLoadingBar');
            const progress = document.getElementById('graphLoadingProgress');
            if (bar && progress) {
                bar.classList.add('active');
                progress.style.width = `${percentage}%`;
            }
        };
        
        const hideProgress = () => {
            const bar = document.getElementById('graphLoadingBar');
            if (bar) {
                setTimeout(() => bar.classList.remove('active'), 500);
            }
        };
        
        // Show loading bar
        showProgress(0);
        
        // Build complete node list from searchIndex
        this.searchIndex.forEach((note) => {
            const nodeId = note.path;
            nodeMap.set(note.name, nodeId);
            nodeMap.set(note.path, nodeId);
            nodeMap.set(note.name.replace('.md', ''), nodeId);
            
            nodes.push({
                id: nodeId,
                name: note.name,
                folder: note.folder,
                path: note.path
            });
            
            linkCounts.set(nodeId, 0);
        });
        
        showProgress(20);
        
        // Fetch all notes in parallel
        const totalNotes = this.searchIndex.length;
        let processedNotes = 0;
        
        const fetchPromises = this.searchIndex.map(async (note) => {
            let content = this.noteCache.get(note.path);
            
            if (!content) {
                try {
                    const rawUrl = `https://raw.githubusercontent.com/${this.vaultOwner}/${this.vaultRepo}/${this.branch}/${encodeURIComponent(note.path)}`;
                    const response = await fetch(rawUrl);
                    if (response.ok) {
                        content = await response.text();
                    }
                } catch (e) {
                    console.warn(`Could not fetch ${note.path}:`, e);
                }
            }
            
            processedNotes++;
            const fetchProgress = 20 + ((processedNotes / totalNotes) * 50);
            showProgress(fetchProgress);
            
            return { path: note.path, content };
        });
        
        const fetchedNotes = await Promise.all(fetchPromises);
        showProgress(70);
        
        // Extract links
        let processedLinks = 0;
        fetchedNotes.forEach(({ path, content }) => {
            if (!content) return;
            
            const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
            let match;
            
            while ((match = wikiLinkRegex.exec(content)) !== null) {
                const linkTarget = match[1];
                const targetPath = this.resolveGraphLink(linkTarget, nodeMap);
                
                if (targetPath && targetPath !== path) {
                    links.push({
                        source: path,
                        target: targetPath
                    });
                    
                    linkCounts.set(path, (linkCounts.get(path) || 0) + 1);
                    linkCounts.set(targetPath, (linkCounts.get(targetPath) || 0) + 1);
                }
            }
            
            processedLinks++;
            const linkProgress = 70 + ((processedLinks / fetchedNotes.length) * 20);
            showProgress(linkProgress);
        });
        
        // Add connection counts
        nodes.forEach(node => {
            node.connections = linkCounts.get(node.id) || 0;
        });
        
        showProgress(100);
        hideProgress();
        
        return { nodes, links };
    }
    
    resolveGraphLink(linkText, nodeMap) {
        /**Resolve a wiki link to an actual node ID**/
        // Try exact match first
        if (nodeMap.has(linkText)) {
            return nodeMap.get(linkText);
        }
        
        // Try with .md extension
        if (nodeMap.has(linkText + '.md')) {
            return nodeMap.get(linkText + '.md');
        }
        
        // Try finding by partial name match
        for (const [key, value] of nodeMap.entries()) {
            if (key.includes(linkText) || linkText.includes(key)) {
                return value;
            }
        }
        
        return null;
    }
    
    async initializeGraph() {
        /**Initialize the Force-Graph visualization with enhanced rendering**/
        if (typeof ForceGraph === 'undefined') {
            console.error('Force-Graph library not loaded');
            return;
        }
        
        const graphContainer = document.getElementById('graphContainer');
        if (!graphContainer) return;
        
        // Build comprehensive graph data
        console.log('Building graph data...');
        const graphData = await this.buildGraphData();
        console.log(`Graph built: ${graphData.nodes.length} nodes, ${graphData.links.length} links`);
        
        // Get current theme colors
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const surfaceColor = isDark ? '#1C1B1E' : '#FDFBFF';
        const onSurfaceColor = isDark ? '#E6E1E6' : '#1C1B1E';
        
        // Enhanced folder color scheme
        const folderColors = {
            'Programming': '#7C4DFF',      // Periwinkle
            'Systems': '#42A5F5',          // Blue  
            'Homelab': '#66BB6A',          // Green
            'Learning': '#FF7043',         // Orange
            'Root': '#AB47BC',             // Purple
            'Computer Related Stuff': '#26C6DA'  // Cyan
        };
        
        // Initialize Force-Graph with enhanced configuration
        this.graph = ForceGraph()(graphContainer)
            .graphData(graphData)
            .nodeId('id')
            .nodeLabel(node => `${node.name} (${node.connections} connections)`)
            .nodeColor(node => folderColors[node.folder] || '#9E9E9E')
            .nodeVal(node => {
                // Size based on connection density (hub detection)
                const baseSize = 4;
                const scaleFactor = 0.5;
                return baseSize + (node.connections * scaleFactor);
            })
            .nodeCanvasObject((node, ctx, globalScale) => {
                // Dynamic node rendering
                const label = node.name.replace('.md', '');
                const fontSize = 10/globalScale;
                const nodeSize = Math.sqrt(node.val) * 2;
                
                // Draw node circle with size based on connections
                ctx.beginPath();
                ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
                ctx.fillStyle = node.color;
                ctx.fill();
                
                // Add border for emphasis
                ctx.strokeStyle = isDark ? '#E6E1E6' : '#1C1B1E';
                ctx.lineWidth = 0.5;
                ctx.stroke();
                
                // Always show label for hub nodes (>3 connections)
                if (node.connections > 3 || this.hoveredNode === node.id) {
                    ctx.font = `${fontSize}px Roboto Flex, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = onSurfaceColor;
                    
                    // Text background for readability
                    const textWidth = ctx.measureText(label).width;
                    ctx.fillStyle = surfaceColor + 'CC'; // Semi-transparent background
                    ctx.fillRect(node.x - textWidth/2 - 2, node.y + nodeSize + 2, textWidth + 4, fontSize + 4);
                    
                    // Draw text
                    ctx.fillStyle = onSurfaceColor;
                    ctx.fillText(label, node.x, node.y + nodeSize + fontSize/2 + 6);
                }
            })
            .linkColor(() => isDark ? '#948F99' : '#79747E')
            .linkWidth(1.5)
            .linkDirectionalParticles(node => {
                // More particles for highly connected nodes
                return node.source.connections > 5 ? 4 : 2;
            })
            .linkDirectionalParticleWidth(2)
            .linkDirectionalParticleSpeed(0.005)
            .backgroundColor(surfaceColor)
            .d3Force('charge', window.d3.forceManyBody().strength(-100))
            .d3Force('link', window.d3.forceLink().distance(50))
            .d3Force('collision', window.d3.forceCollide().radius(node => Math.sqrt(node.val) * 2 + 5))
            .onNodeHover(node => {
                this.hoveredNode = node ? node.id : null;
                graphContainer.style.cursor = node ? 'pointer' : 'default';
            })
            .onNodeClick(node => {
                if (node && node.path) {
                    console.log('Navigating to:', node.path);
                    this.loadNote(node.path);
                }
            })
            .cooldownTicks(100)
            .onEngineStop(() => {
                console.log('Graph simulation stabilized');
            });
        
        // Store graph instance
        this.graphInstance = this.graph;
        
        // Trigger initial zoom to fit
        setTimeout(() => {
            this.graph.zoomToFit(400, 50);
        }, 500);
    }
    
    toggleGraphPanel() {
        /**Toggle graph panel visibility**/
        const panel = document.getElementById('graphPanel');
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            if (!this.graphInstance) {
                this.initializeGraph();
            }
        } else {
            panel.classList.add('hidden');
        }
    }
    
    expandGraphPanel() {
        /**Expand graph panel to full screen**/
        const panel = document.getElementById('graphPanel');
        const expandBtn = document.getElementById('graphExpandBtn');
        const expandIcon = expandBtn.querySelector('.material-symbols-outlined');
        
        if (panel.classList.contains('expanded')) {
            panel.classList.remove('expanded');
            expandIcon.textContent = 'open_in_full';
        } else {
            panel.classList.add('expanded');
            expandIcon.textContent = 'close_fullscreen';
        }
        
        // Trigger graph resize
        if (this.graphInstance) {
            setTimeout(() => {
                this.graphInstance.width(panel.clientWidth);
                this.graphInstance.height(panel.clientHeight - 48);
            }, 300);
        }
    }
}

// Initialize Garden
const garden = new ObsidianGarden();
document.addEventListener('DOMContentLoaded', () => {
    garden.init();
    
    // Graph panel event handlers
    document.getElementById('graphExpandBtn').addEventListener('click', () => {
        garden.expandGraphPanel();
    });
    
    document.getElementById('graphCloseBtn').addEventListener('click', () => {
        garden.toggleGraphPanel();
    });
    
    document.getElementById('graphToggleBtn').addEventListener('click', () => {
        garden.toggleGraphPanel();
    });
    
    // Initialize graph after a short delay to ensure notes are loaded
    setTimeout(() => {
        garden.initializeGraph();
    }, 2000);
    
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
