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
