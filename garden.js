// garden.js - GitHub Pages Obsidian Integration
class ObsidianGarden {
    constructor() {
        // UPDATE THESE TWO LINES WITH YOUR INFO
        this.vaultOwner = 'AIMDaAlien';
        this.vaultRepo = 'obsidian-vault';  // Your repo name
        this.branch = 'main';
        
        this.noteCache = new Map();
        this.searchIndex = [];
        this.currentNote = null;
    }

    async init() {
        this.showLoading();
        
        try {
            const structure = await this.fetchVaultStructure();
            this.buildSidebar(structure);
            await this.loadNote('🗺️ Knowledge Base - Main Index.md');
        } catch (error) {
            console.error('Initialization error:', error);
            document.getElementById('noteContent').innerHTML = 
                '<p>Error loading knowledge garden. Check console for details.</p>';
        } finally {
            this.hideLoading();
        }
    }

    async fetchVaultStructure() {
        const response = await fetch(
            `https://api.github.com/repos/${this.vaultOwner}/${this.vaultRepo}/git/trees/${this.branch}?recursive=true`,
            { headers: { 'Accept': 'application/vnd.github.v3+json' } }
        );
        
        if (!response.ok) throw new Error('Failed to fetch vault structure');
        
        const data = await response.json();
        return this.parseTreeStructure(data.tree);
    }

    parseTreeStructure(tree) {
        const structure = {};
        const privateFolders = ['Career', 'Myself'];  // Private folders
        
        tree.forEach(item => {
            if (item.path.endsWith('.md')) {
                const parts = item.path.split('/');
                const folder = parts.length > 1 ? parts[0] : 'Root';
                
                // Skip private folders
                if (privateFolders.includes(folder)) return;
                
                const fileName = parts[parts.length - 1].replace('.md', '');
                
                if (!structure[folder]) structure[folder] = [];
                structure[folder].push({
                    name: fileName,
                    path: item.path,
                    size: item.size
                });
                
                this.searchIndex.push({
                    name: fileName,
                    path: item.path,
                    folder: folder
                });
            }
        });
        
        return structure;
    }

    buildSidebar(structure) {
        const sidebar = document.getElementById('folderStructure');
        sidebar.innerHTML = '';
        
        Object.entries(structure).forEach(([folder, notes]) => {
            const folderDiv = document.createElement('div');
            folderDiv.className = 'folder-group';
            
            const header = document.createElement('div');
            header.className = 'folder-item folder-header';
            header.innerHTML = `📁 ${folder}`;
            header.onclick = () => this.toggleFolder(folderDiv);
            
            const notesList = document.createElement('ul');
            notesList.className = 'notes-list';
            notesList.style.display = 'none';
            
            notes.forEach(note => {
                const item = document.createElement('li');
                item.className = 'note-item';
                item.innerHTML = `📄 ${note.name}`;
                item.onclick = () => this.loadNote(note.path);
                notesList.appendChild(item);
            });
            
            folderDiv.appendChild(header);
            folderDiv.appendChild(notesList);
            sidebar.appendChild(folderDiv);
        });
    }

    toggleFolder(folderDiv) {
        const list = folderDiv.querySelector('.notes-list');
        const header = folderDiv.querySelector('.folder-header');
        const isOpen = list.style.display !== 'none';
        
        list.style.display = isOpen ? 'none' : 'block';
        header.innerHTML = header.innerHTML.replace(
            isOpen ? '📂' : '📁', 
            isOpen ? '📁' : '📂'
        );
    }

    async loadNote(path) {
        this.showLoading();
        document.body.classList.add('viewing-note');
        
        try {
            let content;
            if (this.noteCache.has(path)) {
                content = this.noteCache.get(path);
            } else {
                const response = await fetch(
                    `https://raw.githubusercontent.com/${this.vaultOwner}/${this.vaultRepo}/${this.branch}/${encodeURIComponent(path)}`
                );
                
                if (!response.ok) throw new Error('Note not found');
                
                content = await response.text();
                this.noteCache.set(path, content);
            }
            
            const html = this.parseMarkdown(content);
            document.getElementById('noteContent').innerHTML = html;
            
            this.updateBreadcrumb(path);
            this.setupInternalLinks();
            this.currentNote = path;
            
        } catch (error) {
            console.error('Error loading note:', error);
            document.getElementById('noteContent').innerHTML = 
                `<p>Failed to load note: ${path}</p>`;
        } finally {
            this.hideLoading();
        }
    }

    parseMarkdown(content) {
        // Remove frontmatter
        content = content.replace(/^---\n[\s\S]*?\n---\n/m, '');
        
        return content
            // Wiki links
            .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, 
                '<span class="note-link" data-link="$1">$2</span>')
            .replace(/\[\[([^\]]+)\]\]/g, 
                '<span class="note-link" data-link="$1">$1</span>')
            // Headers
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            // Formatting
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            // Code blocks
            .replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>')
            // Lists
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
            // Blockquotes
            .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
            // Paragraphs
            .replace(/\n\n/g, '</p><p>')
            .replace(/^([^<].+)$/gm, '<p>$1</p>');
    }

    setupInternalLinks() {
        document.querySelectorAll('.note-link').forEach(link => {
            link.onclick = async () => {
                const notePath = link.dataset.link;
                const fullPath = await this.resolveNotePath(notePath);
                if (fullPath) this.loadNote(fullPath);
            };
        });
    }

    async resolveNotePath(partialPath) {
        // Try with .md extension
        const withMd = partialPath.endsWith('.md') ? partialPath : partialPath + '.md';
        
        // Search in index
        const match = this.searchIndex.find(n => 
            n.path === withMd || n.name === partialPath
        );
        
        return match ? match.path : withMd;
    }

    updateBreadcrumb(path) {
        const parts = path.replace('.md', '').split('/');
        document.getElementById('breadcrumb').innerHTML = parts.join(' › ');
    }

    loadMainIndex() {
        this.loadNote('🗺️ Knowledge Base - Main Index.md');
        document.body.classList.remove('viewing-note');
    }

    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
    }

    showLoading() {
        document.querySelector('.loading-spinner').style.display = 'block';
    }

    hideLoading() {
        document.querySelector('.loading-spinner').style.display = 'none';
    }
}

// Initialize
const garden = new ObsidianGarden();
document.addEventListener('DOMContentLoaded', () => garden.init());