// tests/garden-graph-logic.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../garden-graph-logic.js');

const HUB = '02 Homelab/Raspberry Pi/Raspberry Pi.md';
const SETUP = '02 Homelab/Raspberry Pi/Pi-hole Setup Guide.md';
const MIGRATION = '02 Homelab/Raspberry Pi/Pi-hole Migration.md';
const BPLUS = '02 Homelab/Hardware/Raspberry Pi B+ Utility Node.md';
const PATHS = '05 Linux and Systems/Fundamentals/Paths.md';
const LONELY = '06 Learning Journals/Lonely.md';
const PRIVATE = '07 Tools and Workflow/Private.md';
const INDEX = '00 Index/Homelab MOC.md';

const MANIFEST = {
  metadata: {
    [HUB]: { publish: true, title: 'Raspberry Pi', tags: ['raspberry-pi', 'homelab'] },
    [SETUP]: { publish: true, title: 'Pi-hole Setup Guide', tags: ['pihole', 'raspberry-pi'] },
    [MIGRATION]: { publish: true, tags: ['pihole', 'homelab'] },
    [BPLUS]: { publish: true, machine: 'bigrig', title: 'Raspberry Pi B+ Utility Node', tags: ['Raspberry-Pi'] },
    [PATHS]: { publish: true, tags: ['linux'] },
    [LONELY]: { publish: true, tags: ['solo-tag'] },
    [PRIVATE]: { publish: false, tags: ['pihole'] },
    [INDEX]: { publish: true, tags: ['homelab'] },
  },
  links: {
    // Duplicate and heading links collapse into one edge; a link to a private note is dropped.
    [HUB]: ['Pi-hole Setup Guide', 'Pi-hole Setup Guide#Hardware|setup', 'Pi-hole Migration', 'Raspberry Pi B+ Utility Node', 'Private'],
    // A merged note links to its own sections; that is not an edge.
    [PATHS]: ['Paths#Absolute Paths|Absolute Paths', 'Paths#Relative Paths|Relative'],
    // The migration links back to the hub: the same undirected edge as hub -> migration.
    [MIGRATION]: ['Raspberry Pi', '02 Homelab/Raspberry Pi/Pi-hole Setup Guide'],
    // Hidden notes and links to notes that do not exist stay out.
    [INDEX]: ['Raspberry Pi'],
    [SETUP]: ['Some Note That Does Not Exist'],
  },
};

const ids = (graph) => graph.nodes.map(n => n.id).sort();
const edge = (a, b) => [a, b].sort().join(' :: ');
const edges = (graph) => graph.links.map(l => edge(l.source, l.target)).sort();

test('notes are the published, listable ones and nothing else', () => {
  const g = G.buildGraph(MANIFEST);
  assert.deepEqual(ids(g), [BPLUS, HUB, MIGRATION, SETUP, PATHS, LONELY].sort());
});

test('edges follow the reader link rules: resolved, undirected, deduped, no self-links', () => {
  const g = G.buildGraph(MANIFEST);
  assert.deepEqual(edges(g), [
    edge(HUB, SETUP), edge(HUB, MIGRATION), edge(HUB, BPLUS), edge(MIGRATION, SETUP),
  ].sort());
  assert.ok(g.links.every(l => l.kind === 'link'));
});

test('a node carries its title, topic, machine and count of distinct neighbours', () => {
  const g = G.buildGraph(MANIFEST);
  const byId = new Map(g.nodes.map(n => [n.id, n]));
  assert.equal(byId.get(HUB).degree, 3);
  assert.equal(byId.get(MIGRATION).degree, 2);
  assert.equal(byId.get(PATHS).degree, 0);
  assert.equal(byId.get(MIGRATION).title, 'Pi-hole Migration');
  assert.equal(byId.get(HUB).topic, 'homelab');
  assert.equal(byId.get(PATHS).topic, 'linux');
  assert.equal(byId.get(BPLUS).machine, 'bigrig');
  assert.equal(byId.get(HUB).machine, 'mac');
  assert.equal(byId.get(HUB).kind, 'note');
});

test('orphans can be left out', () => {
  const g = G.buildGraph(MANIFEST, { orphans: false });
  assert.deepEqual(ids(g), [BPLUS, HUB, MIGRATION, SETUP].sort());
});

test('tags become nodes only when asked, and only when two or more notes share them', () => {
  const g = G.buildGraph(MANIFEST, { tags: true });
  const tagNodes = g.nodes.filter(n => n.kind === 'tag').map(n => n.id).sort();
  // homelab: hub + migration (the hidden index does not count); pihole: setup + migration (private does not count).
  assert.deepEqual(tagNodes, ['tag:homelab', 'tag:pihole', 'tag:raspberry-pi']);
  const rpi = g.nodes.find(n => n.id === 'tag:raspberry-pi');
  assert.equal(rpi.title, '#raspberry-pi');
  assert.equal(rpi.degree, 3);
  const tagEdges = g.links.filter(l => l.kind === 'tag').map(l => edge(l.source, l.target)).sort();
  assert.ok(tagEdges.includes(edge('tag:raspberry-pi', BPLUS)), 'the bigrig note joins the mac notes through the tag');
  assert.equal(tagEdges.length, 7);
});

test('with tags on, a note joined only by a tag is no longer an orphan', () => {
  const MORE = { metadata: { ...MANIFEST.metadata, '05 Linux and Systems/Shell.md': { publish: true, tags: ['linux'] } }, links: MANIFEST.links };
  const g = G.buildGraph(MORE, { tags: true, orphans: false });
  assert.ok(ids(g).includes(PATHS));
  assert.ok(!ids(g).includes(LONELY));
});

test('the local graph holds the note and its direct neighbours, with the edges among them', () => {
  const g = G.buildGraph(MANIFEST);
  const local = G.localGraph(g, SETUP);
  assert.equal(local.center, SETUP);
  assert.deepEqual(ids(local), [HUB, MIGRATION, SETUP].sort());
  assert.deepEqual(edges(local), [edge(HUB, SETUP), edge(MIGRATION, SETUP), edge(HUB, MIGRATION)].sort());
});

test('the local graph reaches a second step when asked', () => {
  const g = G.buildGraph(MANIFEST);
  assert.deepEqual(ids(G.localGraph(g, BPLUS)), [BPLUS, HUB].sort());
  assert.deepEqual(ids(G.localGraph(g, BPLUS, { depth: 2 })), [BPLUS, HUB, MIGRATION, SETUP].sort());
});

test('the local graph of an unknown or unlinked note is empty', () => {
  const g = G.buildGraph(MANIFEST);
  assert.equal(G.localGraph(g, PATHS).nodes.length, 0);
  assert.equal(G.localGraph(g, 'nope.md').nodes.length, 0);
});

test('hubs draw bigger, within limits', () => {
  assert.ok(G.nodeRadius({ kind: 'note', degree: 0 }) >= 2.5);
  assert.ok(G.nodeRadius({ kind: 'note', degree: 9 }) > G.nodeRadius({ kind: 'note', degree: 1 }));
  assert.ok(G.nodeRadius({ kind: 'note', degree: 400 }) <= 16);
  assert.ok(G.nodeRadius({ kind: 'tag', degree: 9 }) < G.nodeRadius({ kind: 'note', degree: 9 }));
});

test('labels fade in as a node grows on screen', () => {
  assert.equal(G.labelAlpha(1, 3), 0, 'a small note at rest has no label');
  assert.equal(G.labelAlpha(0.9, 7.6), 0, 'nor does a middling one: only hubs speak at rest');
  assert.equal(G.labelAlpha(1, 14), 1, 'a hub at rest is labelled');
  assert.equal(G.labelAlpha(4, 3), 1, 'zoomed in, every note is labelled');
  const mid = G.labelAlpha(2.5, 3.5);
  assert.ok(mid > 0 && mid < 1, 'there is a fade between');
});

test('search matches titles and tags, ignoring case', () => {
  const g = G.buildGraph(MANIFEST, { tags: true });
  assert.deepEqual([...G.searchGraph(g, 'PI-HOLE')].sort(), [MIGRATION, SETUP].sort());
  assert.ok(G.searchGraph(g, 'pihole').has('tag:pihole'));
  assert.equal(G.searchGraph(g, '  ').size, 0);
});

test('neighbours map both ends of every edge', () => {
  const g = G.buildGraph(MANIFEST);
  const nb = G.neighbourMap(g.links);
  assert.deepEqual([...nb.get(HUB)].sort(), [BPLUS, MIGRATION, SETUP].sort());
  assert.deepEqual([...nb.get(BPLUS)], [HUB]);
});
