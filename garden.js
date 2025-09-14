// garden.js - Handles Obsidian note loading and navigation
class KnowledgeGarden {
    constructor() {
        this.currentNote = null;
        this.noteCache = new Map();
        this.folderStructure = {
            "Programming": [
                "Computer Science Concepts",
                "Python Fundamentals", 
                "Python Data Structures",
                "Python Control Flow",
                "Python Functions",
                "Python Advanced Topics",
                "C Programming",
                "Web Development"
            ],
            "Career": [
                "Personal Brand & Writing",
                "Job Search Strategy",
                "Interview Mastery",
                "Skill Development"
            ],
            "Systems": [
                "Development Tools",
                "Operating Systems",
                "Personal Setup"
            ],
            "Myself": [],
            "Computer Related Stuff": []
        };
    }

    init() {
        this.initializeFolderStructure();
        this.loadMainIndex();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.note) {
                this.loadNote(e.state.note, false);
            } else {
                this.loadMainIndex(false);
            }
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    initializeFolderStructure() {
        const folderList = document.getElementById('folderStructure');
        folderList.innerHTML = '';
        
        Object.keys(this.folderStructure).forEach(folder => {
            const folderDiv = document.createElement('div');
            folderDiv.className = 'folder-group';
            
            const folderHeader = document.createElement('div');
            folderHeader.className = 'folder-item folder-header';
            folderHeader.innerHTML = `📁 ${folder}`;
            folderHeader.onclick = () => this.toggleFolder(folderDiv);
            
            const notesList = document.createElement('ul');
            notesList.className = 'notes-list';
            notesList.style.display = 'none';
            
            this.folderStructure[folder].forEach(note => {
                const noteItem = document.createElement('li');
                noteItem.className = 'note-item';
                noteItem.innerHTML = `📄 ${note}`;
                noteItem.onclick = () => this.loadNote(`${folder}/${note}`);
                notesList.appendChild(noteItem);
            });
            
            folderDiv.appendChild(folderHeader);
            folderDiv.appendChild(notesList);
            folderList.appendChild(folderDiv);
        });
    }

    toggleFolder(folderDiv) {
        const notesList = folderDiv.querySelector('.notes-list');
        const isOpen = notesList.style.display !== 'none';
        notesList.style.display = isOpen ? 'none' : 'block';
        
        const header = folderDiv.querySelector('.folder-header');
        header.innerHTML = isOpen ? 
            header.innerHTML.replace('📂', '📁') : 
            header.innerHTML.replace('📁', '📂');
    }

    async loadMainIndex(updateHistory = true) {
        document.body.classList.remove('viewing-note');
        document.getElementById('breadcrumb').innerHTML = '<span class="breadcrumb-link">Main Index</span>';
        
        this.showLoading();
        
        try {
            // In production, this would fetch from your backend
            const content = await this.fetchMainIndexContent();
            document.getElementById('noteContent').innerHTML = this.renderMarkdown(content);
            
            if (updateHistory) {
                history.pushState({ note: null }, 'Knowledge Garden', '#index');
            }
        } catch (error) {
            console.error('Error loading main index:', error);
            document.getElementById('noteContent').innerHTML = '<p>Error loading content. Please try again.</p>';
        } finally {
            this.hideLoading();
        }
    }

    async loadNote(notePath, updateHistory = true) {
        document.body.classList.add('viewing-note');
        
        // Update breadcrumb
        const parts = notePath.split('/');
        let breadcrumbHTML = '<a href="#" class="breadcrumb-link" onclick="garden.loadMainIndex()">Main Index</a>';
        parts.forEach((part, index) => {
            breadcrumbHTML += ' <span class="breadcrumb-separator">›</span> ';
            if (index === 0) {
                breadcrumbHTML += `<a href="#" class="breadcrumb-link" onclick="garden.loadFolder('${part}')">${part}</a>`;
            } else {
                breadcrumbHTML += `<span class="breadcrumb-link">${part}</span>`;
            }
        });
        document.getElementById('breadcrumb').innerHTML = breadcrumbHTML;
        
        this.showLoading();
        
        try {
            // Check cache first
            let content;
            if (this.noteCache.has(notePath)) {
                content = this.noteCache.get(notePath);
            } else {
                // In production, fetch from backend
                content = await this.fetchNoteContent(notePath);
                this.noteCache.set(notePath, content);
            }
            
            document.getElementById('noteContent').innerHTML = this.renderMarkdown(content);
            
            if (updateHistory) {
                history.pushState({ note: notePath }, notePath, `#${notePath.replace(/\s/g, '-')}`);
            }
            
            this.currentNote = notePath;
            this.setupNoteLinks();
            
        } catch (error) {
            console.error('Error loading note:', error);
            document.getElementById('noteContent').innerHTML = `
                <h1>Note Not Found</h1>
                <p>The note "${notePath}" could not be loaded.</p>
                <p><a href="#" onclick="garden.loadMainIndex()">Return to Main Index</a></p>
            `;
        } finally {
            this.hideLoading();
        }
    }

    loadFolder(folderName) {
        // Show all notes in a folder
        const notes = this.folderStructure[folderName] || [];
        let content = `<h1>📁 ${folderName}</h1>\n<ul>`;
        
        notes.forEach(note => {
            content += `<li><span class="note-link" onclick="garden.loadNote('${folderName}/${note}')">${note}</span></li>`;
        });
        
        content += '</ul>';
        
        document.getElementById('noteContent').innerHTML = content;
        document.body.classList.remove('viewing-note');
    }

    setupNoteLinks() {
        // Convert [[wiki links]] to clickable links
        const content = document.getElementById('noteContent');
        content.innerHTML = content.innerHTML.replace(
            /\[\[([^\]]+)\]\]/g,
            (match, linkText) => {
                const linkPath = this.resolveLinkPath(linkText);
                return `<span class="note-link" onclick="garden.loadNote('${linkPath}')">${linkText}</span>`;
            }
        );
    }

    resolveLinkPath(linkText) {
        // Resolve partial paths to full paths
        // This would be more sophisticated in production
        for (const [folder, notes] of Object.entries(this.folderStructure)) {
            if (notes.includes(linkText)) {
                return `${folder}/${linkText}`;
            }
        }
        return linkText;
    }

    renderMarkdown(content) {
        // Basic markdown to HTML conversion
        // In production, use a proper markdown parser
        return content
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$2</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^([^<].+)$/gm, '<p>$1</p>');
    }

    showLoading() {
        document.querySelector('.loading-spinner').style.display = 'block';
        document.getElementById('noteContent').style.opacity = '0.5';
    }

    hideLoading() {
        document.querySelector('.loading-spinner').style.display = 'none';
        document.getElementById('noteContent').style.opacity = '1';
    }

    // Mock fetch functions - replace with actual API calls
    async fetchMainIndexContent() {
        // This would fetch from your backend
        return `# 🗺️ Knowledge Base - Main Index

Welcome to your organized knowledge vault! This is your central 司令塔 (しれいとう - command center) for navigating all your notes.

## 🚀 Quick Access
- Start Here: [[Python Fundamentals]] - Begin your programming journey
- Career Track: [[Personal Brand & Writing]] - Professional communication

## 🎯 Learning Paths

### 💻 Programming Track
1. [[Computer Science Concepts]] ← Start here for theory
2. [[Python Fundamentals]] ← Learn your first language  
3. [[Python Data Structures]] ← Organize your data
4. [[Python Control Flow]] ← Make smart decisions  
5. [[Python Functions]] ← Write reusable code
6. [[Python Advanced Topics]] ← Professional techniques
7. [[C Programming]] ← Understand how computers work

### 🏢 Career Development Track  
1. [[Personal Brand & Writing]] ← Professional communication
2. [[Job Search Strategy]] ← Land that dream job
3. [[Interview Mastery]] ← Ace the interviews
4. [[Skill Development]] ← Continuous improvement

### ⚙️ Systems & Tools Track
1. [[Development Tools]] ← IDEs, Git, productivity
2. [[Operating Systems]] ← How computers manage resources  
3. [[Personal Setup]] ← Optimize your workspace

> **連鎖学習 (れんさがくしゅう - "chain learning")**: Each topic builds on the previous, creating strong knowledge connections.`;
    }

    async fetchNoteContent(notePath) {
        // This would fetch from your backend
        return `# ${notePath.split('/').pop()}

This is the content for: ${notePath}

## Overview
Content would be loaded from your Obsidian vault here.

## Key Concepts
- Concept 1
- Concept 2
- Concept 3

## Related Notes
- [[Python Fundamentals]]
- [[Computer Science Concepts]]`;
    }
}

// Initialize garden on page load
const garden = new KnowledgeGarden();
document.addEventListener('DOMContentLoaded', () => {
    garden.init();
});