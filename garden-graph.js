/**
 * Knowledge Garden Graph View
 * Zettelkasten-style graph with [[wikilink]] parsing
 */

class KnowledgeGardenGraph {
    constructor() {
        this.config = {
            nodeRadius: 5,
            linkDistance: 50,
            chargeStrength: -80
        };

        this.vaultOwner = 'AIMDaAlien';
        this.vaultRepo = 'Obsidian-Vault';
        this.hiddenItems = ['.obsidian', '.stfolder', '.DS_Store', '.gitignore', 'Myself', 'Business', 'images'];

        // Colors by folder
        this.folderColors = {
            'IT Projects': '#22D3EE',
            'Learning': '#F59E0B',
            'Meta': '#A78BFA',
            'Projects': '#3B82F6',
            'Router Configuration': '#10B981',
            'Sessions': '#F97316',
            'Technical': '#8B5CF6',
            'Computer Related Stuff': '#EC4899',
            'Web': '#FF6B6B',
            'sun': '#FFD93D',
            'root': '#7C3AED'
        };

        this.nodes = [];
        this.links = [];
        this.nameToNode = new Map(); // Map note name -> node for linking

        this.svg = null;
        this.simulation = null;
        this.container = null;
        this.isVisible = false;
    }

    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.container.innerHTML = '<div style="color:#A78BFA;text-align:center;padding:50px;font-family:monospace;">Parsing vault for [[wikilinks]]...</div>';

        await this.fetchGraphData();

        this.container.innerHTML = '';
        this.createSVG();
        this.createTooltip();
        this.createLegend();
        this.setupSimulation();
        this.render();

        window.addEventListener('resize', () => this.handleResize());
    }

    async fetchGraphData() {
        try {
            // Get full tree
            const treeRes = await fetch(
                `https://api.github.com/repos/${this.vaultOwner}/${this.vaultRepo}/git/trees/main?recursive=1`
            );
            if (!treeRes.ok) throw new Error('API failed');
            const treeData = await treeRes.json();

            // Collect all markdown files
            const mdFiles = (treeData.tree || []).filter(item => {
                if (item.type !== 'blob' || !item.path.endsWith('.md')) return false;
                const parts = item.path.split('/');
                return !parts.some(p => this.hiddenItems.includes(p) || p.startsWith('.'));
            });

            // Build nodes
            this.nodes = [];
            this.nameToNode = new Map();

            // Add central "sun" node
            const sunNode = {
                id: '_sun_',
                name: 'Knowledge Garden',
                folder: 'sun',
                path: null,
                connections: 100,
                isSun: true
            };
            this.nodes.push(sunNode);

            mdFiles.forEach(file => {
                const fileName = file.path.split('/').pop().replace('.md', '');
                let folder = file.path.includes('/') ? file.path.split('/')[0] : 'root';

                // Categorize Step notes as Web
                if (/^Step\s*\d/i.test(fileName)) {
                    folder = 'Web';
                }

                const node = {
                    id: file.path,
                    name: fileName,
                    folder: folder,
                    path: file.path,
                    connections: 0
                };

                this.nodes.push(node);
                // Map by lowercase name for matching
                this.nameToNode.set(fileName.toLowerCase(), node);
            });

            // Fetch ALL note content and parse [[links]]
            this.links = [];
            const linkSet = new Set(); // Avoid duplicates

            // Fetch notes in batches
            const batchSize = 20;
            for (let i = 0; i < mdFiles.length; i += batchSize) {
                const batch = mdFiles.slice(i, i + batchSize);
                await Promise.all(batch.map(file => this.parseFileLinks(file.path, linkSet)));
            }

            // Update connection counts
            this.nodes.forEach(node => {
                node.connections = this.links.filter(l =>
                    l.source === node.id || l.target === node.id
                ).length;
            });

            console.log(`Graph: ${this.nodes.length} nodes, ${this.links.length} links`);

        } catch (error) {
            console.error('Graph error:', error);
            this.nodes = [{ id: 'error', name: 'Failed to load', folder: 'root' }];
            this.links = [];
        }
    }

    async parseFileLinks(filePath, linkSet) {
        try {
            // Properly encode path - each segment separately
            const encodedPath = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
            const url = `https://raw.githubusercontent.com/${this.vaultOwner}/${this.vaultRepo}/main/${encodedPath}`;

            const res = await fetch(url);
            if (!res.ok) return;

            const content = await res.text();

            // Parse [[wikilinks]] - matches [[Note Name]] or [[Note Name|Display Text]]
            const linkRegex = /\[\[([^\]|#]+)(?:[#|][^\]]+)?\]\]/g;
            let match;

            while ((match = linkRegex.exec(content)) !== null) {
                const linkName = match[1].trim().toLowerCase();
                const targetNode = this.nameToNode.get(linkName);

                if (targetNode && targetNode.id !== filePath) {
                    const linkKey = [filePath, targetNode.id].sort().join('::');
                    if (!linkSet.has(linkKey)) {
                        linkSet.add(linkKey);
                        this.links.push({
                            source: filePath,
                            target: targetNode.id
                        });
                    }
                }
            }
        } catch (e) {
            // Skip errors silently
        }
    }

    getNodeColor(node) {
        return this.folderColors[node.folder] || '#A78BFA';
    }

    createSVG() {
        const rect = this.container.getBoundingClientRect();

        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${rect.width} ${rect.height}`);

        this.currentZoom = 1;
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (e) => {
                this.svgGroup.attr('transform', e.transform);
                this.currentZoom = e.transform.k;
                // Scale labels inversely with zoom
                if (this.labelElements) {
                    const labelScale = Math.min(1.5, 1 / e.transform.k);
                    this.labelElements
                        .style('font-size', d => d.isSun ? `${11 * labelScale}px` : `${9 * labelScale}px`)
                        .style('opacity', e.transform.k > 0.5 ? 0.85 : 0);
                }
            });

        this.svg.call(this.zoom);
        this.svgGroup = this.svg.append('g');
        this.linksGroup = this.svgGroup.append('g');
        this.nodesGroup = this.svgGroup.append('g');
    }

    createTooltip() {
        this.tooltip = d3.select(this.container)
            .append('div')
            .attr('class', 'graph-tooltip')
            .style('opacity', 0);
    }

    createLegend() {
        const folders = [...new Set(this.nodes.map(n => n.folder))].filter(f => f !== 'root');
        const legend = document.createElement('div');
        legend.className = 'graph-legend';
        legend.innerHTML = `
            <div class="legend-title">Folders</div>
            ${folders.map(folder => `
                <div class="legend-item">
                    <span class="legend-color" style="background:${this.folderColors[folder] || '#A78BFA'}"></span>
                    <span class="legend-label">${folder}</span>
                </div>
            `).join('')}
            <div class="legend-stats">${this.nodes.length} notes • ${this.links.length} links</div>
        `;
        this.container.appendChild(legend);
    }

    setupSimulation() {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Pin the sun to the center
        const sunNode = this.nodes.find(n => n.isSun);
        if (sunNode) {
            sunNode.fx = centerX;
            sunNode.fy = centerY;
        }

        // Web notes cluster position (bottom-right quadrant)
        const webX = centerX + rect.width * 0.25;
        const webY = centerY + rect.height * 0.25;

        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links)
                .id(d => d.id)
                .distance(40)
                .strength(0.8))
            // Mass-based charge: more connections = stronger pull
            .force('charge', d3.forceManyBody()
                .strength(d => d.isSun ? -20 : (-30 + (d.connections * 3))))
            // Pull toward sun or Web cluster
            .force('x', d3.forceX(d => {
                if (d.isSun) return centerX;
                if (d.folder === 'Web') return webX;
                return centerX;
            }).strength(d => d.folder === 'Web' ? 0.3 : 0.05))
            .force('y', d3.forceY(d => {
                if (d.isSun) return centerY;
                if (d.folder === 'Web') return webY;
                return centerY;
            }).strength(d => d.folder === 'Web' ? 0.3 : 0.05))
            // Radial force: connected nodes closer, orphans further (skip Web and sun)
            .force('radial', d3.forceRadial(
                d => (d.isSun || d.folder === 'Web') ? null : Math.max(80, 350 - d.connections * 25),
                centerX, centerY
            ).strength(d => (d.isSun || d.folder === 'Web') ? 0 : 0.2))
            .force('collision', d3.forceCollide().radius(d =>
                d.isSun ? 25 : Math.max(4, 4 + Math.sqrt(d.connections) * 2) + 2))
            .on('tick', () => this.tick());
    }

    render() {
        // Links
        this.linkElements = this.linksGroup
            .selectAll('line')
            .data(this.links)
            .enter()
            .append('line')
            .style('stroke', 'rgba(167, 139, 250, 0.3)')
            .style('stroke-width', 1);

        // Nodes
        this.nodeElements = this.nodesGroup
            .selectAll('circle')
            .data(this.nodes)
            .enter()
            .append('circle')
            .attr('r', d => d.isSun ? 18 : Math.max(3, 3 + Math.sqrt(d.connections) * 2))
            .attr('fill', d => this.getNodeColor(d))
            .style('cursor', 'pointer')
            .style('filter', d => d.isSun ? 'drop-shadow(0 0 8px #FFD93D)' : 'none')
            .call(this.drag())
            .on('mouseover', (e, d) => this.showTooltip(e, d))
            .on('mouseout', () => this.hideTooltip())
            .on('click', (e, d) => this.handleClick(e, d));

        // Labels for well-connected nodes and sun
        this.labelElements = this.nodesGroup
            .selectAll('text')
            .data(this.nodes.filter(n => n.connections >= 2 || n.isSun))
            .enter()
            .append('text')
            .attr('dy', d => d.isSun ? 25 : Math.max(3, 3 + Math.sqrt(d.connections) * 2) + 10)
            .attr('text-anchor', 'middle')
            .text(d => d.name.length > 20 ? d.name.slice(0, 18) + '...' : d.name)
            .style('font-size', d => d.isSun ? '11px' : '9px')
            .style('font-weight', d => d.isSun ? '600' : '400')
            .style('fill', d => d.isSun ? '#FFD93D' : 'rgba(255,255,255,0.85)')
            .style('text-shadow', '0 1px 3px rgba(0,0,0,0.8)')
            .style('pointer-events', 'none');
    }

    tick() {
        this.linkElements
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        this.nodeElements
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);

        this.labelElements
            ?.attr('x', d => d.x)
            .attr('y', d => d.y);
    }

    drag() {
        return d3.drag()
            .on('start', (e, d) => {
                if (!e.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
            .on('end', (e, d) => {
                if (!e.active) this.simulation.alphaTarget(0);
                d.fx = null; d.fy = null;
            });
    }

    showTooltip(event, node) {
        this.tooltip
            .html(`<strong>${node.name}</strong><br>${node.folder}<br>${node.connections} links`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .style('opacity', 1);

        // Highlight connected
        const connected = new Set([node.id]);
        this.links.forEach(l => {
            const src = typeof l.source === 'object' ? l.source.id : l.source;
            const tgt = typeof l.target === 'object' ? l.target.id : l.target;
            if (src === node.id) connected.add(tgt);
            if (tgt === node.id) connected.add(src);
        });

        this.nodeElements.style('opacity', d => connected.has(d.id) ? 1 : 0.1);
        this.linkElements.style('opacity', l => {
            const src = typeof l.source === 'object' ? l.source.id : l.source;
            const tgt = typeof l.target === 'object' ? l.target.id : l.target;
            return (src === node.id || tgt === node.id) ? 1 : 0.03;
        });
    }

    hideTooltip() {
        this.tooltip.style('opacity', 0);
        this.nodeElements.style('opacity', 1);
        this.linkElements.style('opacity', 1);
    }

    handleClick(event, node) {
        event.stopPropagation();
        if (node.isSun) return; // Don't navigate for sun

        if (node.path && window.garden) {
            // Hide graph and navigate to note
            document.getElementById('graphContainer').style.display = 'none';
            window.garden.viewFileByPath(node.path);
        }
    }

    show() {
        this.isVisible = true;
        this.simulation?.alpha(0.3).restart();
    }

    hide() { this.isVisible = false; }

    handleResize() {
        if (!this.isVisible || !this.svg) return;
        const rect = this.container.getBoundingClientRect();
        this.svg.attr('viewBox', `0 0 ${rect.width} ${rect.height}`);
    }

    animate() { this.simulation?.alpha(1).restart(); }
}

window.KnowledgeGardenGraph = KnowledgeGardenGraph;
