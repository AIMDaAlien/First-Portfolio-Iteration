/**
 * Knowledge Garden Graph View
 * Dynamic graph from GitHub API with D3.js
 */

class KnowledgeGardenGraph {
    constructor() {
        // Config
        this.config = {
            nodeRadius: 8,
            linkDistance: 100,
            chargeStrength: -300,
            centerStrength: 0.05
        };

        // GitHub config
        this.vaultOwner = 'AIMDaAlien';
        this.vaultRepo = 'Obsidian-Vault';
        this.hiddenItems = ['.obsidian', '.stfolder', '.DS_Store', '.gitignore', 'Myself', 'Business', 'images'];

        // Color palette by folder
        this.groupColors = {
            'Computer Related Stuff': '#10B981',
            'IT Projects': '#3B82F6',
            'Learning': '#F59E0B',
            'Meta': '#EC4899',
            'Projects': '#22D3EE',
            'Router Configuration': '#10B981',
            'Sessions': '#F97316',
            'Technical': '#8B5CF6',
            'root': '#7C3AED',
            'default': '#A78BFA'
        };

        // Data
        this.nodes = [];
        this.links = [];

        // D3
        this.svg = null;
        this.simulation = null;
        this.container = null;
        this.tooltip = null;
        this.isVisible = false;
    }

    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        // Show loading
        this.container.innerHTML = '<div style="color:#A78BFA;text-align:center;padding:50px;">Loading graph...</div>';

        // Fetch data from GitHub
        await this.fetchGraphData();

        // Clear loading
        this.container.innerHTML = '';

        // Create SVG
        this.createSVG();
        this.createTooltip();
        this.createLegend();
        this.setupSimulation();
        this.render();

        window.addEventListener('resize', () => this.handleResize());
    }

    async fetchGraphData() {
        try {
            const response = await fetch(
                `https://api.github.com/repos/${this.vaultOwner}/${this.vaultRepo}/git/trees/main?recursive=1`
            );
            if (!response.ok) throw new Error('API failed');

            const data = await response.json();
            const tree = data.tree || [];

            // Build nodes and links
            this.nodes = [{ id: 'root', name: 'Knowledge Garden', group: 'root', isHub: true, connections: 0 }];
            this.links = [];

            const folders = new Set();
            const filesByFolder = {};

            // Process tree
            tree.forEach(item => {
                const parts = item.path.split('/');
                const isHidden = parts.some(p => this.hiddenItems.includes(p) || p.startsWith('.'));
                if (isHidden) return;

                if (item.type === 'tree' && parts.length === 1) {
                    // Top-level folder
                    folders.add(item.path);
                    filesByFolder[item.path] = [];
                } else if (item.type === 'blob' && item.path.endsWith('.md')) {
                    const folder = parts.length > 1 ? parts[0] : 'root';
                    if (!filesByFolder[folder]) filesByFolder[folder] = [];
                    filesByFolder[folder].push({
                        path: item.path,
                        name: parts[parts.length - 1].replace('.md', '')
                    });
                }
            });

            // Add folder nodes
            folders.forEach(folder => {
                if (!this.hiddenItems.includes(folder)) {
                    this.nodes.push({
                        id: folder,
                        name: folder,
                        group: folder,
                        isHub: true,
                        connections: (filesByFolder[folder] || []).length + 1
                    });
                    this.links.push({ source: 'root', target: folder });
                }
            });

            // Add file nodes (limit to prevent overload)
            let fileCount = 0;
            const maxFiles = 50;

            Object.entries(filesByFolder).forEach(([folder, files]) => {
                if (this.hiddenItems.includes(folder)) return;

                files.slice(0, 10).forEach(file => {
                    if (fileCount >= maxFiles) return;
                    fileCount++;

                    const nodeId = file.path.replace(/[\/\s\.]/g, '_');
                    this.nodes.push({
                        id: nodeId,
                        name: file.name,
                        group: folder,
                        path: file.path,
                        connections: 1
                    });

                    const target = folders.has(folder) ? folder : 'root';
                    this.links.push({ source: target, target: nodeId });
                });
            });

            // Update connection counts
            this.nodes.forEach(node => {
                node.connections = this.links.filter(l =>
                    l.source === node.id || l.target === node.id
                ).length;
            });

        } catch (error) {
            console.error('Graph fetch error:', error);
            // Fallback data
            this.nodes = [{ id: 'root', name: 'Failed to load', group: 'default', isHub: true }];
            this.links = [];
        }
    }

    createSVG() {
        const rect = this.container.getBoundingClientRect();

        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${rect.width} ${rect.height}`);

        this.zoom = d3.zoom()
            .scaleExtent([0.2, 4])
            .on('zoom', (event) => this.svgGroup.attr('transform', event.transform));

        this.svg.call(this.zoom);
        this.svgGroup = this.svg.append('g');
        this.linksGroup = this.svgGroup.append('g').attr('class', 'links');
        this.nodesGroup = this.svgGroup.append('g').attr('class', 'nodes');
    }

    createTooltip() {
        this.tooltip = d3.select(this.container)
            .append('div')
            .attr('class', 'graph-tooltip')
            .style('opacity', 0);
    }

    createLegend() {
        const legend = document.createElement('div');
        legend.className = 'graph-legend';
        legend.innerHTML = `
            <div class="legend-title">Categories</div>
            ${Object.entries(this.groupColors)
                .filter(([k]) => k !== 'default' && k !== 'root')
                .map(([name, color]) => `
                    <div class="legend-item">
                        <span class="legend-color" style="background:${color}"></span>
                        <span class="legend-label">${name}</span>
                    </div>
                `).join('')}
        `;
        this.container.appendChild(legend);
    }

    setupSimulation() {
        const rect = this.container.getBoundingClientRect();

        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links)
                .id(d => d.id)
                .distance(this.config.linkDistance))
            .force('charge', d3.forceManyBody()
                .strength(this.config.chargeStrength))
            .force('center', d3.forceCenter(rect.width / 2, rect.height / 2))
            .force('collision', d3.forceCollide().radius(20))
            .on('tick', () => this.tick());
    }

    render() {
        // Links
        this.linkElements = this.linksGroup
            .selectAll('line')
            .data(this.links)
            .enter()
            .append('line')
            .style('stroke', 'rgba(124, 58, 237, 0.3)')
            .style('stroke-width', 1);

        // Nodes
        this.nodeElements = this.nodesGroup
            .selectAll('g')
            .data(this.nodes)
            .enter()
            .append('g')
            .call(this.drag())
            .on('mouseover', (e, d) => this.showTooltip(e, d))
            .on('mouseout', () => this.hideTooltip())
            .on('click', (e, d) => this.handleClick(e, d));

        // Circles
        this.nodeElements
            .append('circle')
            .attr('r', d => d.isHub ? 16 : 8 + Math.min(d.connections * 2, 6))
            .attr('fill', d => this.groupColors[d.group] || this.groupColors.default)
            .style('cursor', 'pointer');

        // Labels
        this.nodeElements
            .append('text')
            .attr('dy', d => (d.isHub ? 16 : 8) + 14)
            .attr('text-anchor', 'middle')
            .text(d => d.name.length > 20 ? d.name.slice(0, 18) + '...' : d.name)
            .style('font-size', '10px')
            .style('fill', 'rgba(255,255,255,0.7)')
            .style('pointer-events', 'none');
    }

    tick() {
        this.linkElements
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        this.nodeElements
            .attr('transform', d => `translate(${d.x},${d.y})`);
    }

    drag() {
        return d3.drag()
            .on('start', (e, d) => {
                if (!e.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (e, d) => {
                d.fx = e.x;
                d.fy = e.y;
            })
            .on('end', (e, d) => {
                if (!e.active) this.simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });
    }

    showTooltip(event, node) {
        this.tooltip
            .html(`<strong>${node.name}</strong><br>${node.connections} connections`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .style('opacity', 1);
    }

    hideTooltip() {
        this.tooltip.style('opacity', 0);
    }

    handleClick(event, node) {
        if (!node.isHub && node.path && window.garden) {
            window.garden.viewFileByPath(node.path);
            document.getElementById('graphContainer').style.display = 'none';
        }
    }

    show() {
        this.isVisible = true;
        this.simulation?.alpha(0.5).restart();
    }

    hide() {
        this.isVisible = false;
    }

    handleResize() {
        if (!this.isVisible || !this.svg) return;
        const rect = this.container.getBoundingClientRect();
        this.svg.attr('viewBox', `0 0 ${rect.width} ${rect.height}`);
    }

    animate() {
        this.simulation?.alpha(1).restart();
    }
}

window.KnowledgeGardenGraph = KnowledgeGardenGraph;
