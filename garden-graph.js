/**
 * Knowledge Garden Graph View
 * Obsidian-like force-directed graph using D3.js
 * Following M3 Expressive aesthetics
 */

class KnowledgeGardenGraph {
    constructor() {
        // Configuration
        this.config = {
            nodeRadius: 8,
            linkDistance: 80,
            chargeStrength: -200,
            centerStrength: 0.05,
            collisionRadius: 15
        };

        // Color palette by group
        this.groupColors = {
            'featured': '#7C3AED',    // Primary lavender
            'homelab': '#10B981',     // Green
            'projects': '#3B82F6',    // Blue
            'career': '#F59E0B',      // Orange
            'privacy': '#EC4899',     // Pink
            'programming': '#22D3EE', // Cyan
            'default': '#A78BFA'      // Light lavender
        };

        // Data
        this.nodes = [];
        this.links = [];

        // D3 objects
        this.svg = null;
        this.simulation = null;
        this.zoom = null;

        // DOM
        this.container = null;
        this.tooltip = null;

        // State
        this.isVisible = false;
        this.selectedNode = null;
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        // Build data from filesystem
        this.buildGraphData();

        // Create SVG
        this.createSVG();

        // Create tooltip
        this.createTooltip();

        // Setup simulation
        this.setupSimulation();

        // Render
        this.render();

        // Handle resize
        window.addEventListener('resize', () => this.handleResize());
    }

    buildGraphData() {
        // Nodes from filesystem
        const filesystem = {
            'featured': {
                files: [
                    { id: 'grapheneos', name: 'GrapheneOS Migration', group: 'featured' },
                    { id: 'truenas', name: 'TrueNAS Build', group: 'featured' },
                    { id: 'pihole', name: 'Pi-hole Setup', group: 'featured' },
                    { id: 'wireguard', name: 'WireGuard VPN', group: 'featured' }
                ]
            },
            'projects': {
                files: [
                    { id: 'budget-nas', name: 'Budget NAS Build', group: 'projects' }
                ]
            },
            'homelab': {
                files: [
                    { id: 'router-opt', name: 'Router Optimization', group: 'homelab' }
                ]
            }
        };

        // Add hub nodes for folders
        this.nodes = [
            { id: 'home', name: 'Knowledge Garden', group: 'default', isHub: true, connections: 3 }
        ];

        // Add folder nodes and file nodes
        Object.entries(filesystem).forEach(([folder, data]) => {
            // Folder node
            this.nodes.push({
                id: folder,
                name: folder.charAt(0).toUpperCase() + folder.slice(1),
                group: folder,
                isHub: true,
                connections: data.files.length + 1
            });

            // Link folder to home
            this.links.push({ source: 'home', target: folder });

            // File nodes
            data.files.forEach(file => {
                this.nodes.push({
                    ...file,
                    connections: 1
                });

                // Link file to folder
                this.links.push({ source: folder, target: file.id });
            });
        });

        // Add some cross-links for realism
        this.links.push(
            { source: 'grapheneos', target: 'wireguard' },
            { source: 'pihole', target: 'router-opt' },
            { source: 'truenas', target: 'budget-nas' }
        );

        // Update connection counts
        this.nodes.forEach(node => {
            const linkCount = this.links.filter(l =>
                l.source === node.id || l.target === node.id ||
                (l.source.id && l.source.id === node.id) ||
                (l.target.id && l.target.id === node.id)
            ).length;
            node.connections = linkCount;
        });
    }

    createSVG() {
        const rect = this.container.getBoundingClientRect();

        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${rect.width} ${rect.height}`)
            .style('background', 'transparent');

        // Add zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.2, 4])
            .on('zoom', (event) => {
                this.svgGroup.attr('transform', event.transform);
            });

        this.svg.call(this.zoom);

        // Create main group for zoom/pan
        this.svgGroup = this.svg.append('g');

        // Create groups for links and nodes
        this.linksGroup = this.svgGroup.append('g').attr('class', 'links');
        this.nodesGroup = this.svgGroup.append('g').attr('class', 'nodes');
    }

    createTooltip() {
        this.tooltip = d3.select(this.container)
            .append('div')
            .attr('class', 'graph-tooltip')
            .style('opacity', 0);
    }

    setupSimulation() {
        const rect = this.container.getBoundingClientRect();

        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links)
                .id(d => d.id)
                .distance(this.config.linkDistance)
                .strength(0.5))
            .force('charge', d3.forceManyBody()
                .strength(this.config.chargeStrength))
            .force('center', d3.forceCenter(rect.width / 2, rect.height / 2)
                .strength(this.config.centerStrength))
            .force('collision', d3.forceCollide()
                .radius(this.config.collisionRadius))
            .on('tick', () => this.tick());
    }

    // ============================================
    // RENDERING
    // ============================================

    render() {
        // Render links
        this.linkElements = this.linksGroup
            .selectAll('line')
            .data(this.links)
            .enter()
            .append('line')
            .attr('class', 'graph-link')
            .style('stroke', 'rgba(124, 58, 237, 0.3)')
            .style('stroke-width', 1);

        // Render nodes
        this.nodeElements = this.nodesGroup
            .selectAll('g')
            .data(this.nodes)
            .enter()
            .append('g')
            .attr('class', 'graph-node')
            .call(this.drag())
            .on('mouseover', (event, d) => this.showTooltip(event, d))
            .on('mouseout', () => this.hideTooltip())
            .on('click', (event, d) => this.handleNodeClick(event, d));

        // Node circles
        this.nodeElements
            .append('circle')
            .attr('r', d => this.getNodeRadius(d))
            .attr('fill', d => this.groupColors[d.group] || this.groupColors.default)
            .style('cursor', 'pointer')
            .style('transition', 'r 0.2s ease, filter 0.2s ease');

        // Node labels
        this.nodeElements
            .append('text')
            .attr('class', 'node-label')
            .attr('dy', d => this.getNodeRadius(d) + 14)
            .attr('text-anchor', 'middle')
            .text(d => d.name)
            .style('font-size', '11px')
            .style('fill', 'rgba(255, 255, 255, 0.7)')
            .style('font-family', "'Ubuntu', sans-serif")
            .style('pointer-events', 'none');
    }

    tick() {
        this.linkElements
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        this.nodeElements
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
    }

    getNodeRadius(node) {
        const base = this.config.nodeRadius;
        if (node.isHub) return base * 2;
        return base + Math.min(node.connections * 2, 8);
    }

    // ============================================
    // INTERACTIONS
    // ============================================

    drag() {
        return d3.drag()
            .on('start', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });
    }

    showTooltip(event, node) {
        this.tooltip
            .html(`
                <div class="tooltip-title">${node.name}</div>
                <div class="tooltip-info">${node.connections} connection${node.connections !== 1 ? 's' : ''}</div>
            `)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .transition()
            .duration(200)
            .style('opacity', 1);

        // Highlight connected nodes
        this.highlightConnected(node);
    }

    hideTooltip() {
        this.tooltip
            .transition()
            .duration(200)
            .style('opacity', 0);

        // Reset highlighting
        this.resetHighlight();
    }

    highlightConnected(node) {
        const connectedIds = new Set([node.id]);
        this.links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;

            if (sourceId === node.id) connectedIds.add(targetId);
            if (targetId === node.id) connectedIds.add(sourceId);
        });

        this.nodeElements
            .style('opacity', d => connectedIds.has(d.id) ? 1 : 0.2);

        this.linkElements
            .style('opacity', link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                return (sourceId === node.id || targetId === node.id) ? 1 : 0.1;
            })
            .style('stroke-width', link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                return (sourceId === node.id || targetId === node.id) ? 2 : 1;
            });
    }

    resetHighlight() {
        this.nodeElements.style('opacity', 1);
        this.linkElements
            .style('opacity', 1)
            .style('stroke-width', 1);
    }

    handleNodeClick(event, node) {
        event.stopPropagation();

        // If terminal exists, execute cat command
        if (window.terminal && !node.isHub) {
            const cmdMap = {
                'grapheneos': 'cat featured/grapheneos-migration.md',
                'truenas': 'cat featured/truenas-build.md',
                'pihole': 'cat featured/pihole-setup.md',
                'wireguard': 'cat featured/wireguard-vpn.md',
                'budget-nas': 'cat projects/budget-nas.md',
                'router-opt': 'cat homelab/router-optimization.md'
            };

            if (cmdMap[node.id]) {
                // Hide graph, show terminal, execute command
                this.hide();
                document.getElementById('terminalWindow').style.display = 'flex';
                terminal.executeCommand(cmdMap[node.id]);
            }
        }
    }

    // ============================================
    // UTILITIES
    // ============================================

    show() {
        this.container.style.display = 'block';
        this.isVisible = true;
        this.simulation.alpha(0.5).restart();
    }

    hide() {
        this.container.style.display = 'none';
        this.isVisible = false;
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    handleResize() {
        if (!this.isVisible) return;

        const rect = this.container.getBoundingClientRect();
        this.svg.attr('viewBox', `0 0 ${rect.width} ${rect.height}`);

        this.simulation
            .force('center', d3.forceCenter(rect.width / 2, rect.height / 2))
            .alpha(0.3)
            .restart();
    }

    animate() {
        this.simulation.alpha(1).restart();
    }

    setNodeSize(multiplier) {
        this.config.nodeRadius = 8 * multiplier;
        this.nodeElements.select('circle')
            .attr('r', d => this.getNodeRadius(d));
    }

    setLinkStrength(strength) {
        this.linkElements.style('stroke-width', strength);
    }
}

// Export for use
window.KnowledgeGardenGraph = KnowledgeGardenGraph;
