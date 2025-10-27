// Graph View with vis.js - Material 3 Expressive Theme

class KnowledgeGraphView {
    constructor(garden) {
        this.garden = garden;
        this.network = null;
        this.nodes = new vis.DataSet();
        this.edges = new vis.DataSet();
        this.graphData = { nodes: [], edges: [], stats: {} };
    }

    async buildGraphData() {
        const nodeMap = new Map();
        const edgeSet = new Set();

        // Process all notes in search index
        for (const note of this.garden.searchIndex) {
            const nodeId = note.path;
            const nodeName = note.name;
            
            // Add node if not exists
            if (!nodeMap.has(nodeId)) {
                nodeMap.set(nodeId, {
                    id: nodeId,
                    label: nodeName,
                    path: note.path,
                    folder: note.folder,
                    connections: 0
                });
            }

            // Parse note content for links
            try {
                const content = await this.garden.fetchNoteContent(note.path);
                const links = this.extractLinks(content);

                links.forEach(linkText => {
                    // Try to resolve the link
                    const targetNote = this.garden.searchIndex.find(n => 
                        n.name === linkText || 
                        n.name === linkText.replace('.md', '') ||
                        n.path.includes(linkText)
                    );

                    if (targetNote) {
                        const edgeId = `${nodeId}->${targetNote.path}`;
                        if (!edgeSet.has(edgeId)) {
                            edgeSet.add(edgeId);
                            
                            // Update connection counts
                            nodeMap.get(nodeId).connections++;
                            if (nodeMap.has(targetNote.path)) {
                                nodeMap.get(targetNote.path).connections++;
                            }
                        }
                    }
                });
            } catch (error) {
                console.warn(`Could not process links for ${note.path}`);
            }
        }

        // Convert to arrays and calculate sizes
        const nodes = Array.from(nodeMap.values()).map(node => {
            const size = 15 + (node.connections * 3);
            const group = this.getNodeGroup(node.connections);
            
            return {
                id: node.id,
                label: node.label,
                title: `${node.label}\n${node.connections} connections\n${node.folder}`,
                size: size,
                group: group,
                value: node.connections,
                path: node.path,
                folder: node.folder,
                connections: node.connections
            };
        });

        const edges = Array.from(edgeSet).map(edgeId => {
            const [from, to] = edgeId.split('->');
            return { from, to };
        });

        this.graphData = {
            nodes,
            edges,
            stats: {
                totalNotes: nodes.length,
                totalConnections: edges.length,
                hubs: nodes.filter(n => n.connections > 5).length,
                isolated: nodes.filter(n => n.connections === 0).length
            }
        };

        console.log('📊 Graph Stats:', this.graphData.stats);
        return this.graphData;
    }

    extractLinks(content) {
        const links = [];
        
        // Extract [[link|text]] format
        const pattern1 = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
        let match;
        while ((match = pattern1.exec(content)) !== null) {
            links.push(match[1].trim());
        }
        
        // Extract [[link]] format
        const pattern2 = /\[\[([^\]]+)\]\]/g;
        while ((match = pattern2.exec(content)) !== null) {
            const link = match[1].trim();
            if (!links.includes(link)) {
                links.push(link);
            }
        }
        
        return links;
    }

    getNodeGroup(connections) {
        if (connections > 5) return 'hub';
        if (connections > 0) return 'connected';
        return 'isolated';
    }

    async render() {
        this.garden.showLoading();

        const contentArea = document.getElementById('noteContent');
        contentArea.innerHTML = `
            <div class="graph-container" id="graphCanvas"></div>
            
            <div class="graph-controls">
                <button class="graph-control-btn" onclick="graphView.fitGraph()">
                    <span class="material-symbols-outlined">fit_screen</span>
                    Fit to Screen
                </button>
                <button class="graph-control-btn" onclick="graphView.resetPhysics()">
                    <span class="material-symbols-outlined">refresh</span>
                    Reset Layout
                </button>
            </div>
            
            <div class="graph-legend">
                <div class="graph-legend-title">Node Types</div>
                <div class="graph-legend-item">
                    <div class="graph-legend-dot hub"></div>
                    <span>Hubs (5+ links)</span>
                </div>
                <div class="graph-legend-item">
                    <div class="graph-legend-dot connected"></div>
                    <span>Connected</span>
                </div>
                <div class="graph-legend-item">
                    <div class="graph-legend-dot isolated"></div>
                    <span>Isolated</span>
                </div>
            </div>
            
            <div class="graph-info-panel" id="graphInfo">
                <div class="graph-info-title">📊 Graph Statistics</div>
                <div class="graph-info-stats">
                    <div><strong>Total Notes:</strong> <span id="stat-notes">-</span></div>
                    <div><strong>Total Links:</strong> <span id="stat-links">-</span></div>
                    <div><strong>Hub Notes:</strong> <span id="stat-hubs">-</span></div>
                    <div><strong>Isolated:</strong> <span id="stat-isolated">-</span></div>
                </div>
            </div>
        `;

        await this.buildGraphData();
        this.initializeNetwork();
        this.updateStats();
        this.garden.hideLoading();

        // Show info panel after a delay
        setTimeout(() => {
            document.getElementById('graphInfo').classList.add('visible');
        }, 500);
    }

    initializeNetwork() {
        const container = document.getElementById('graphCanvas');
        
        const data = {
            nodes: this.graphData.nodes,
            edges: this.graphData.edges
        };

        const options = {
            nodes: {
                shape: 'dot',
                font: {
                    color: '#fafafa',
                    size: 14,
                    face: 'Ubuntu, Roboto Flex'
                },
                borderWidth: 3,
                borderWidthSelected: 4,
                shadow: {
                    enabled: true,
                    color: 'rgba(157, 148, 217, 0.5)',
                    size: 10,
                    x: 0,
                    y: 0
                }
            },
            edges: {
                color: {
                    color: 'rgba(157, 148, 217, 0.4)',
                    highlight: 'rgba(180, 168, 255, 0.8)',
                    hover: 'rgba(157, 148, 217, 0.6)'
                },
                width: 2,
                smooth: {
                    type: 'continuous',
                    roundness: 0.5
                },
                selectionWidth: 3,
                hoverWidth: 2
            },
            groups: {
                hub: {
                    color: {
                        background: '#d4c8ff',
                        border: '#b4a8ff',
                        highlight: { background: '#e4d8ff', border: '#d4c8ff' },
                        hover: { background: '#c4b8ef', border: '#b4a8ff' }
                    }
                },
                connected: {
                    color: {
                        background: '#b4a8ff',
                        border: '#9d94d9',
                        highlight: { background: '#c4b8ff', border: '#b4a8ff' },
                        hover: { background: '#a498ef', border: '#9d94d9' }
                    }
                },
                isolated: {
                    color: {
                        background: '#9d94d9',
                        border: '#8b7fc7',
                        highlight: { background: '#ada4e9', border: '#9d94d9' },
                        hover: { background: '#8d84c7', border: '#8b7fc7' }
                    }
                }
            },
            physics: {
                enabled: true,
                barnesHut: {
                    gravitationalConstant: -2000,
                    centralGravity: 0.3,
                    springLength: 150,
                    springConstant: 0.04,
                    damping: 0.09,
                    avoidOverlap: 0.5
                },
                stabilization: {
                    enabled: true,
                    iterations: 1000,
                    fit: true
                }
            },
            interaction: {
                hover: true,
                tooltipDelay: 100,
                zoomView: true,
                dragView: true,
                navigationButtons: true,
                keyboard: {
                    enabled: true
                }
            }
        };

        this.network = new vis.Network(container, data, options);

        // Event handlers
        this.network.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = this.graphData.nodes.find(n => n.id === nodeId);
                if (node) {
                    this.garden.loadNote(node.path);
                }
            }
        });

        this.network.on('doubleClick', (params) => {
            if (params.nodes.length > 0) {
                this.network.focus(params.nodes[0], {
                    scale: 1.5,
                    animation: {
                        duration: 500,
                        easingFunction: 'easeInOutQuad'
                    }
                });
            }
        });

        this.network.on('stabilizationProgress', (params) => {
            const progress = Math.round((params.iterations / params.total) * 100);
            console.log(`Graph stabilizing: ${progress}%`);
        });

        this.network.on('stabilizationIterationsDone', () => {
            console.log('✓ Graph stabilized');
            this.network.setOptions({ physics: false });
        });
    }

    updateStats() {
        document.getElementById('stat-notes').textContent = this.graphData.stats.totalNotes;
        document.getElementById('stat-links').textContent = this.graphData.stats.totalConnections;
        document.getElementById('stat-hubs').textContent = this.graphData.stats.hubs;
        document.getElementById('stat-isolated').textContent = this.graphData.stats.isolated;
    }

    fitGraph() {
        if (this.network) {
            this.network.fit({
                animation: {
                    duration: 500,
                    easingFunction: 'easeInOutQuad'
                }
            });
        }
    }

    resetPhysics() {
        if (this.network) {
            this.network.setOptions({ physics: true });
            this.network.stabilize();
            setTimeout(() => {
                this.network.setOptions({ physics: false });
            }, 3000);
        }
    }
}

// Global graph view instance
let graphView = null;
