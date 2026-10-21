// tests/garden-reader.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../garden-reader-logic.js');

const META = {
  '01 Projects/Penthouse/00 - Knowledge Hub.md': { publish: true, featured: 1, title: 'The Penthouse Rebuild Knowledge Hub', summary: 'Map of the rebuild', tags: ['penthouse'], updated: '2026-10-12' },
  '02 Homelab/Guides/TrueNAS Build Guide.md': { publish: true, featured: 4, title: 'TrueNAS Build Guide', summary: 'Budget SAS NAS', tags: ['truenas'], updated: '2026-10-17' },
  '03 AI and Local Models/Benchmarks/Strata V100.md': { publish: true, featured: 7, title: 'Strata V100 setup and benchmarks', machine: 'bigrig', updated: '2026-10-12' },
  '04 Programming/Regex.md': { publish: true, title: 'Regex', updated: '2026-01-01' },
  '05 Linux and Systems/Shell/Pipes.md': { publish: true, title: 'Pipes', updated: '2026-02-01' },
  '05 Linux and Systems/Shell/Dupe.md': { publish: true, title: 'Pipes', featured: 50, updated: '2026-02-02' },
  '07 Tools and Workflow/Obsidian Vault Git Sync.md': { publish: false, featured: 77, title: 'Obsidian Vault Git Sync' },
  '_attachments/x.md': { publish: true, title: 'Hidden' },
  'README.md': { publish: true, title: 'README' },
};

test('TOPICS order and the Programming fold', () => {
  assert.deepEqual(L.TOPICS.map(t => t.id), ['projects', 'homelab', 'ai', 'linux', 'journals', 'tools']);
  assert.deepEqual(L.TOPICS.find(t => t.id === 'linux').folders, ['05 Linux and Systems', '04 Programming']);
});

test('topicForPath maps folders and returns null for unknown or hidden', () => {
  assert.equal(L.topicForPath('04 Programming/Regex.md').id, 'linux');
  assert.equal(L.topicForPath('02 Homelab/Guides/TrueNAS Build Guide.md').id, 'homelab');
  assert.equal(L.topicForPath('00 Index/Projects Index.md'), null);
  assert.equal(L.topicForPath('README.md'), null);
});

test('buildTitleIndex keys stem and title, skips unpublished and hidden, resolves collisions by rank', () => {
  const idx = L.buildTitleIndex(META);
  assert.equal(idx.get('00 - knowledge hub'), '01 Projects/Penthouse/00 - Knowledge Hub.md');
  assert.equal(idx.get('the penthouse rebuild knowledge hub'), '01 Projects/Penthouse/00 - Knowledge Hub.md');
  assert.equal(idx.get('pipes'), '05 Linux and Systems/Shell/Dupe.md'); // featured 50 beats unranked
  assert.equal(idx.has('obsidian vault git sync'), false);
  assert.equal(idx.has('hidden'), false);
  assert.equal(idx.has('readme'), false);
});

test('resolveWikilink strips heading and alias', () => {
  const idx = L.buildTitleIndex(META);
  assert.equal(L.resolveWikilink('TrueNAS Build Guide#Parts|the guide', idx), '02 Homelab/Guides/TrueNAS Build Guide.md');
  assert.equal(L.resolveWikilink('Nope', idx), null);
});

test('rewriteWikilinks rewrites resolved, flattens unresolved, skips code', () => {
  const idx = L.buildTitleIndex(META);
  const md = 'See [[TrueNAS Build Guide|the guide]] and [[Nope#x|gone]].\n```\n[[TrueNAS Build Guide]]\n```\nInline `[[Pipes]]` stays.';
  const out = L.rewriteWikilinks(md, idx);
  assert.match(out, /\[the guide\]\(\?note=02%20Homelab%2FGuides%2FTrueNAS%20Build%20Guide\.md\)/);
  assert.match(out, /and gone\./);
  assert.match(out, /```\n\[\[TrueNAS Build Guide\]\]\n```/);
  assert.match(out, /`\[\[Pipes\]\]`/);
});

test('noteHref and notePathFromSearch round-trip awkward characters', () => {
  const p = '01 Projects/A & B/C#1 100%.md';
  assert.equal(L.notePathFromSearch(L.noteHref(p)), p);
  assert.equal(L.notePathFromSearch('?x=1'), null);
});

test('rewriteWikilinks drops unresolved embeds and links resolved ones', () => {
  const idx = L.buildTitleIndex(META);
  assert.equal(L.rewriteWikilinks('a ![[img.png]] b', idx), 'a  b');
  assert.match(L.rewriteWikilinks('![[Regex]]', idx), /^\[Regex\]\(\?note=04%20Programming%2FRegex\.md\)$/);
});

test('relatedNotes resolves both directions, drops unpublished and self, caps at limit', () => {
  const idx = L.buildTitleIndex(META);
  const links = {
    '01 Projects/Penthouse/00 - Knowledge Hub.md': ['TrueNAS Build Guide', 'Obsidian Vault Git Sync', 'Nope', '00 - Knowledge Hub'],
    '02 Homelab/Guides/TrueNAS Build Guide.md': ['The Penthouse Rebuild Knowledge Hub'],
    '04 Programming/Regex.md': ['00 - Knowledge Hub'],
    '07 Tools and Workflow/Obsidian Vault Git Sync.md': ['00 - Knowledge Hub'],
  };
  const r = L.relatedNotes('01 Projects/Penthouse/00 - Knowledge Hub.md', META, links, idx, 5);
  assert.deepEqual(r.outgoing, ['02 Homelab/Guides/TrueNAS Build Guide.md']);
  assert.deepEqual(r.incoming, ['02 Homelab/Guides/TrueNAS Build Guide.md', '04 Programming/Regex.md']);
  assert.deepEqual(L.relatedNotes('01 Projects/Penthouse/00 - Knowledge Hub.md', META, links, idx, 1).incoming, ['02 Homelab/Guides/TrueNAS Build Guide.md']);
});

test('filterNotes matches title, summary, tags; blank query returns all', () => {
  const entries = L.featuredStrip(META);
  assert.equal(L.filterNotes('  ', entries).length, entries.length);
  assert.deepEqual(L.filterNotes('sas', entries).map(e => e.path), ['02 Homelab/Guides/TrueNAS Build Guide.md']);
  assert.deepEqual(L.filterNotes('PENTHOUSE', entries).map(e => e.path), ['01 Projects/Penthouse/00 - Knowledge Hub.md']);
});

test('readingTime rounds up and floors at one minute', () => {
  assert.equal(L.readingTime('one two three'), 1);
  assert.equal(L.readingTime(Array(401).fill('w').join(' ')), 3);
});

test('snippetFromMarkdown takes the first paragraph, strips noise, truncates on a word', () => {
  const md = '---\ntitle: x\n---\n# Heading\n![[img.png]]\n\nThis is the **first** paragraph with a [[Wiki Link|link]] inside. ' + 'word '.repeat(60);
  const s = L.snippetFromMarkdown(md, 60);
  assert.ok(s.startsWith('This is the first paragraph with a link inside.'));
  assert.ok(s.endsWith('…'));
  assert.ok(s.length <= 61);
  assert.equal(L.snippetFromMarkdown('```\ncode\n```\n'), '');
});

test('groupByTopic lists every topic, orders ranked then unranked, excludes unpublished', () => {
  const g = L.groupByTopic(META);
  assert.deepEqual([...g.keys()], ['projects', 'homelab', 'ai', 'linux', 'journals', 'tools']);
  assert.deepEqual(g.get('linux').ranked.map(e => e.path), ['05 Linux and Systems/Shell/Dupe.md']);
  assert.deepEqual(g.get('linux').unranked.map(e => e.path), ['05 Linux and Systems/Shell/Pipes.md', '04 Programming/Regex.md']);
  assert.deepEqual(g.get('journals'), { ranked: [], unranked: [] });
  assert.deepEqual(g.get('tools'), { ranked: [], unranked: [] });
});

test('featuredStrip returns ranks 1..limit sorted and ignores unpublished', () => {
  assert.deepEqual(L.featuredStrip(META, 10).map(e => e.featured), [1, 4, 7]);
  assert.deepEqual(L.featuredStrip(META, 5).map(e => e.featured), [1, 4]);
});

test('isListable hides unpublished, dot and hidden segments, and root housekeeping files', () => {
  assert.equal(L.isListable('01 Projects/Penthouse/00 - Knowledge Hub.md', META['01 Projects/Penthouse/00 - Knowledge Hub.md']), true);
  assert.equal(L.isListable('07 Tools and Workflow/Obsidian Vault Git Sync.md', META['07 Tools and Workflow/Obsidian Vault Git Sync.md']), false);
  assert.equal(L.isListable('_attachments/x.md', META['_attachments/x.md']), false);
  assert.equal(L.isListable('README.md', META['README.md']), false);
  assert.equal(L.isListable('markdown practice.md', { publish: true }), false);
  assert.equal(L.isListable('00 Index/Projects Index.md', { publish: true }), false);
  assert.equal(L.isListable('.obsidian/app.json', { publish: true }), false);
  assert.equal(L.isListable('02 Homelab/Homelab Index.md', undefined), false);
});

test('readStoredMode defaults to reader and accepts only known values', () => {
  const store = (v) => ({ getItem: () => v });
  assert.equal(L.readStoredMode(store(null)), 'reader');
  assert.equal(L.readStoredMode(store('terminal')), 'terminal');
  assert.equal(L.readStoredMode(store('bogus')), 'reader');
  assert.equal(L.readStoredMode({ getItem() { throw new Error('blocked'); } }), 'reader');
});

test('isTypingTarget is true for inputs, textareas, selects, contenteditable', () => {
  assert.equal(L.isTypingTarget({ tagName: 'INPUT' }), true);
  assert.equal(L.isTypingTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(L.isTypingTarget({ tagName: 'SELECT' }), true);
  assert.equal(L.isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(L.isTypingTarget({ tagName: 'DIV' }), false);
  assert.equal(L.isTypingTarget(null), false);
});
