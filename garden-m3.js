// Material Design 3 Knowledge Garden with Corner Graph Widget
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
        this.cornerGraph = null; // Corner graph widget instance
        
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
            
            // 🎯 Initialize corner graph widget after everything loads
            console.log('🌸 Initializing **グラフ** (gurafu - graph) widget...');
            this.cornerGraph = new CornerGraphWidget(this);
            
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
            
            // **更新** (kōshin - update) corner graph if loaded
            if (this.cornerGraph) {
                this.cornerGraph.onNoteChanged(path);
            }
            
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
            content = content.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (match, link, text) => {
                return `<span class="wiki-link-marker" data-link="${link}">${text}</span>`;
            });
            content = content.replace(/\[\[([^\]]+)\]\]/g, (match, link) => {
                return `<span class="wiki-link-marker" data-link="${link}">${link}</span>`;
            });
            
            // Preprocess: Convert Obsidian tags to styled spans
            content = content.replace(/(^|\s)(#[a-zA-Z][a-zA-Z0-9_-]*)/g, (match, space, tag) => {
                return `${space}<span class="note-tag">${tag}</span>`;
            });
            
            // Convert Obsidian callouts to blockquotes
            content = content.replace(/^> \[!(\w+)\]\s*(.*)$/gm, (match, type, title) => {
                return `> **${type.toUpperCase()}${title ? ': ' + title : ''}**`;
            });
            
            // Parse with marked.js
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
    
    // Additional functionality for navigation rail
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
                html += `<li><a href="javascript:void(0)" class="note-link" data-link="${note.path}" onclick="garden.loadNote('${note.path}')">${note.name}</a></li>`;
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

// Corner Graph Widget Class
class CornerGraphWidget {
    constructor(gardenInstance) {
        this.garden = gardenInstance;
        this.widget = document.getElementById('cornerGraphWidget');
        this.svg = d3.select('#cornerGraphSvg');
        this.tooltip = document.getElementById('graphTooltip');
        this.currentMode = 'normal';
        this.expandedNodes = new Set(['🗺️ Knowledge Base - Main Index.md']);
        this.graphData = { nodes: [], links: [] };
        this.simulation = null;
        this.hoveredNode = null;
        
        this.initializeWidget();
    }
    
    async initializeWidget() {
        console.log('🌸 **初期化** (shoki-ka - initialization) corner graph widget...');
        
        // Build graph data from vault
        await this.buildGraphFromVault();
        this.setupEventListeners();
        this.makeDraggable();
        this.renderGraph();
        
        // Start with main index expanded after a delay
        setTimeout(() => {
            this.expandNode('🗺️ Knowledge Base - Main Index.md');
        }, 1500);
    }
    
    async buildGraphFromVault() {
        const nodes = [];
        const links = [];
        const nodeMap = new Map();
        const folderNodes = new Map();
        
        // Create folder nodes
        const folders = [...new Set(this.garden.searchIndex.map(item => item.folder))];
        folders.forEach(folderName => {
            const folderId = `folder:${folderName}`;
            folderNodes.set(folderName, folderId);
            nodes.push({
                id: folderId,
                name: folderName,
                folder: folderName,
                type: 'folder',
                connections: 0
            });
            nodeMap.set(folderName, folderId);
        });
        
        // Create note nodes and folder connections
        this.garden.searchIndex.forEach(item => {
            const nodeId = item.path;
            nodes.push({
                id: nodeId,
                name: item.name,
                folder: item.folder,
                type: 'note',
                connections: 0
            });
            nodeMap.set(item.name, nodeId);
            nodeMap.set(item.path, nodeId);
            
            // Connect note to its folder
            const folderId = folderNodes.get(item.folder);
            if (folderId && folderId !== nodeId) {
                links.push({
                    source: folderId,
                    target: nodeId
                });
            }
        });
        
        // Add cross-references based on note content (simplified)
        // In a full implementation, you'd parse actual wiki-links from cached content
        this.addMockConnections(links, nodeMap);
        
        // Calculate connection counts
        const linkCounts = new Map();
        nodes.forEach(node => linkCounts.set(node.id, 0));
        
        links.forEach(link => {
            linkCounts.set(link.source, (linkCounts.get(link.source) || 0) + 1);
            linkCounts.set(link.target, (linkCounts.get(link.target) || 0) + 1);
        });
        
        nodes.forEach(node => {
            node.connections = linkCounts.get(node.id) || 0;
        });
        
        this.graphData = { nodes, links };
        console.log(`📊 Graph built: ${nodes.length} nodes, ${links.length} links`);
        
        // Update connection count in UI
        document.getElementById('connectionCount').textContent = `${nodes.filter(n => n.type === 'note').length} notes`;
    }
    
    addMockConnections(links, nodeMap) {
        // Add some realistic cross-connections based on your vault structure
        const connections = [
            // Programming connections
            ['Python Fundamentals', 'Python Data Structures'],
            ['Python Fundamentals', 'Python Control Flow'],
            ['Python Fundamentals', 'Python Functions'],
            ['Python Advanced Topics', 'Computer Science Concepts'],
            ['Computer Science Concepts', 'Python Data Structures'],
            
            // Cross-domain connections
            ['Skill Development', 'folder:Programming'],
            ['Development Tools', 'folder:Programming'],
            ['🗺️ Knowledge Base - Main Index.md', 'folder:Programming'],
            ['🗺️ Knowledge Base - Main Index.md', 'folder:Systems'],
            ['🗺️ Knowledge Base - Main Index.md', 'folder:Homelab'],
            ['🗺️ Knowledge Base - Main Index.md', 'folder:Learning']
        ];
        
        connections.forEach(([source, target]) => {
            const sourceId = nodeMap.get(source);
            const targetId = nodeMap.get(target);
            
            if (sourceId && targetId && sourceId !== targetId) {
                links.push({ source: sourceId, target: targetId });
            }
        });
    }
    
    getVisibleNodes() {
        const visibleIds = new Set();
        
        // Always show main index
        visibleIds.add('🗺️ Knowledge Base - Main Index.md');
        
        // Add expanded nodes and their immediate neighbors
        this.expandedNodes.forEach(nodeId => {
            visibleIds.add(nodeId);
            
            this.graphData.links.forEach(link => {
                if (link.source === nodeId || (link.source.id && link.source.id === nodeId)) {
                    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
                    visibleIds.add(targetId);
                }
                if (link.target === nodeId || (link.target.id && link.target.id === nodeId)) {
                    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
                    visibleIds.add(sourceId);
                }
            });
        });
        
        return Array.from(visibleIds);
    }
    
    renderGraph() {
        if (this.currentMode === 'mini') return;
        
        const container = document.getElementById('cornerGraphContainer');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Clear existing
        this.svg.selectAll('*').remove();
        if (this.simulation) {
            this.simulation.stop();
        }
        
        const visibleNodeIds = this.getVisibleNodes();
        const visibleNodes = this.graphData.nodes.filter(n => visibleNodeIds.includes(n.id));
        const visibleLinks = this.graphData.links.filter(l => {
            const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
            const targetId = typeof l.target === 'string' ? l.target : l.target.id;
            return visibleNodeIds.includes(sourceId) && visibleNodeIds.includes(targetId);
        });
        
        console.log(`🎯 Rendering: ${visibleNodes.length} nodes, ${visibleLinks.length} links`);
        
        // Create D3 force simulation
        this.simulation = d3.forceSimulation(visibleNodes)
            .force('link', d3.forceLink(visibleLinks).id(d => d.id).distance(40))
            .force('charge', d3.forceManyBody().strength(-200))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(15));
        
        // Create links
        const link = this.svg.append('g')
            .selectAll('line')
            .data(visibleLinks)
            .enter().append('line')
            .attr('class', 'graph-link');
        
        // Create nodes
        const node = this.svg.append('g')
            .selectAll('circle')
            .data(visibleNodes)
            .enter().append('circle')
            .attr('class', d => `graph-node ${d.type}`)
            .attr('r', d => d.type === 'folder' ? 14 : 10)
            .call(this.drag(this.simulation))
            .on('click', (event, d) => {
                event.stopPropagation();
                if (event.detail === 1) {
                    // Single click: expand/collapse
                    setTimeout(() => {
                        if (!event.defaultPrevented) {
                            this.expandNode(d.id);
                        }
                    }, 200);
                }
            })
            .on('dblclick', (event, d) => {
                event.preventDefault();
                // Double click: navigate to note (only for notes, not folders)
                if (d.type === 'note') {
                    console.log('🔗 **ナビゲート** (nabigēto - navigate) to:', d.id);
                    this.garden.loadNote(d.id);
                }
            })
            .on('mouseover', (event, d) => {
                this.showTooltip(event, d);
                this.highlightConnections(d);
                this.hoveredNode = d.id;
            })
            .on('mouseout', () => {
                this.hideTooltip();
                this.clearHighlights();
                this.hoveredNode = null;
            });
        
        // Create labels for important nodes
        const label = this.svg.append('g')
            .selectAll('text')
            .data(visibleNodes.filter(d => d.connections > 2 || d.type === 'folder'))
            .enter().append('text')
            .attr('class', 'node-label visible')
            .text(d => d.name)
            .attr('dy', d => (d.type === 'folder' ? 18 : 14) + 4);
        
        // Update simulation
        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
            
            label
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });
        
        // Stop simulation after convergence
        this.simulation.alpha(1).restart();
        setTimeout(() => {
            if (this.simulation) this.simulation.stop();
        }, 3000);
    }
    
    expandNode(nodeId) {
        if (this.expandedNodes.has(nodeId)) {
            this.expandedNodes.delete(nodeId);
            console.log(`🔄 **折りたたみ** (oritata-mi - collapse): ${nodeId}`);
        } else {
            this.expandedNodes.add(nodeId);
            console.log(`🔄 **展開** (tenkai - expand): ${nodeId}`);
        }
        
        this.renderGraph();
        
        // Visual feedback
        this.widget.style.transform = 'scale(1.02)';
        setTimeout(() => {
            this.widget.style.transform = 'scale(1)';
        }, 200);
    }
    
    highlightConnections(node) {
        const connectedIds = new Set();
        
        this.svg.selectAll('.graph-link').each(function(d) {
            const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
            const targetId = typeof d.target === 'string' ? d.target : d.target.id;
            
            if (sourceId === node.id) {
                connectedIds.add(targetId);
                d3.select(this).classed('highlighted', true);
            } else if (targetId === node.id) {
                connectedIds.add(sourceId);
                d3.select(this).classed('highlighted', true);
            }
        });
        
        this.svg.selectAll('.graph-node')
            .classed('dimmed', d => d.id !== node.id && !connectedIds.has(d.id))
            .classed('connected', d => connectedIds.has(d.id))
            .classed('hovered', d => d.id === node.id);
    }
    
    clearHighlights() {
        this.svg.selectAll('.graph-link').classed('highlighted', false);
        this.svg.selectAll('.graph-node').classed('dimmed connected hovered', false);
    }
    
    showTooltip(event, node) {
        this.tooltip.innerHTML = `
            <strong>${node.name}</strong><br>
            Type: ${node.type}<br>
            Folder: ${node.folder}<br>
            Connections: ${node.connections}
        `;
        
        const rect = this.widget.getBoundingClientRect();
        this.tooltip.style.left = (event.clientX - rect.left + 10) + 'px';
        this.tooltip.style.top = (event.clientY - rect.top - 10) + 'px';
        this.tooltip.classList.add('visible');
    }
    
    hideTooltip() {
        this.tooltip.classList.remove('visible');
    }
    
    setMode(mode) {
        this.widget.className = 'corner-graph-widget';
        if (mode !== 'normal') {
            this.widget.classList.add(mode);
        }
        this.currentMode = mode;
        
        // Update title based on mode
        const titleText = document.getElementById('cornerGraphTitle');
        switch (mode) {
            case 'mini':
                titleText.textContent = '🗺️';
                break;
            case 'normal':
                titleText.textContent = 'Knowledge Map';
                break;
            case 'expanded':
                titleText.textContent = 'Knowledge Graph';
                break;
            case 'maximized':
                titleText.textContent = 'Knowledge Graph - Full Screen';
                break;
        }
        
        setTimeout(() => this.renderGraph(), 400);
    }
    
    cycleMode() {
        const modes = ['mini', 'normal', 'expanded', 'maximized'];
        const currentIndex = modes.indexOf(this.currentMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        this.setMode(nextMode);
    }
    
    makeDraggable() {
        const header = document.getElementById('cornerGraphHeader');
        let isDragging = false;
        let startX, startY, initialX, initialY;
        
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = this.widget.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            this.widget.style.left = (initialX + deltaX) + 'px';
            this.widget.style.top = (initialY + deltaY) + 'px';
            this.widget.style.right = 'auto';
            this.widget.style.bottom = 'auto';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        // Header click to cycle modes
        header.addEventListener('click', (e) => {
            if (!isDragging && e.target === header) {
                this.cycleMode();
            }
        });
    }
    
    setupEventListeners() {
        document.getElementById('cornerExpandBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.setMode('expanded');
        });
        
        document.getElementById('cornerMinimizeBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.setMode('mini');
        });
    }
    
    onNoteChanged(notePath) {
        // Called when a note is loaded - could highlight current note
        console.log(`📍 Current note: ${notePath}`);
        
        // Add current note to expanded nodes if not already there
        if (!this.expandedNodes.has(notePath)) {
            this.expandedNodes.add(notePath);
            this.renderGraph();
        }
    }
    
    drag(simulation) {
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
        
        return d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended);
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
    
    // Graph toggle button
    document.getElementById('graphToggleBtn').addEventListener('click', () => {
        if (garden.cornerGraph) {
            garden.cornerGraph.cycleMode();
        }
    });
});
