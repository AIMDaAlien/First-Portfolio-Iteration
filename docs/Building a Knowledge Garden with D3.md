# Building a Knowledge Garden with D3.js

A Zettelkasten-style graph visualization for exploring interconnected notes.

---

## Overview

A Knowledge Garden is a visual, interactive way to explore a collection of notes. It uses a force-directed graph where:

- **Nodes** represent individual notes
- **Edges** represent connections (wikilinks) between notes
- **Colors** indicate categories or folders
- The layout naturally clusters related content

---

## Core Architecture

### Data Flow

```
GitHub API --> Fetch Markdown Files --> Parse Wikilinks --> Create Graph Data --> D3.js Visualization
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `fetchGraphData()` | Retrieves file tree from GitHub API |
| `parseFileLinks()` | Extracts `[[wikilinks]]` from content |
| `setupSimulation()` | Configures D3 force physics |
| `render()` | Creates SVG nodes, links, labels |

---

## Wikilink Parsing

Extract connections between notes using regex:

```javascript
const wikilinkPattern = /\[\[([^\]]+)\]\]/g;
let match;
while ((match = wikilinkPattern.exec(content)) !== null) {
    const linkName = match[1].split('|')[0].trim();
    // Match to existing node by lowercase name
    const targetNode = this.nameToNode.get(linkName.toLowerCase());
    if (targetNode) {
        this.links.push({ source: currentNode.id, target: targetNode.id });
    }
}
```

**Key considerations:**
- Case-insensitive matching
- Handle pipe aliases: `[[Note|Display Text]]`
- URL-encode paths with spaces for API calls

---

## Force Physics Configuration

D3.js uses forces to position nodes. A "solar system" model:

```javascript
this.simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(-30))
    .force('link', d3.forceLink(links).distance(40))
    .force('center', d3.forceCenter(width/2, height/2))
    .force('radial', d3.forceRadial(
        d => 350 - d.connections * 25, // More links = closer to center
        centerX, centerY
    ))
    .force('collision', d3.forceCollide().radius(d => nodeRadius + 2));
```

### Force Types

| Force | Effect |
|-------|--------|
| `charge` | Nodes repel each other |
| `link` | Connected nodes attract |
| `center` | Pulls everything toward center |
| `radial` | Positions by distance from center |
| `collision` | Prevents overlap |

---

## Curating Important Nodes

Rather than showing labels based on link count, curate a list of important notes:

```javascript
this.importantNotes = new Set([
    'development tools',
    'getting started guide',
    'main index',
    // ... other key notes
]);

// Show labels only for curated notes
.data(nodes.filter(n => this.importantNotes.has(n.name.toLowerCase())))
```

---

## Related Notes

- [[D3.js Force Simulation Guide]]
- [[GitHub API for Content Fetching]]
- [[Mobile Responsive Graph Views]]
