// tests/garden-reader-groups.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../garden-reader-logic.js');

const META = {
  '01 Projects/Penthouse/00 - Knowledge Hub.md': { publish: true, featured: 1, title: 'The Penthouse Rebuild Knowledge Hub', updated: '2026-10-12' },
  '01 Projects/Penthouse/Wiring.md': { publish: true, title: 'Wiring', updated: '2026-10-01' },
  '01 Projects/Strata/A.md': { publish: true, title: 'A', updated: '2026-03-02' },
  '01 Projects/Strata/B.md': { publish: true, title: 'B', updated: '2026-03-01' },
  '01 Projects/Strata/C.md': { publish: true, title: 'C', updated: '2026-03-03' },
  '01 Projects/Strata/D.md': { publish: true, title: 'D', updated: '2026-01-01' },
  '01 Projects/Strata/E.md': { publish: true, title: 'E', updated: '2026-03-02T12:00:00Z' },
  '01 Projects/Loose.md': { publish: true, title: 'Loose', updated: '2026-05-01' },
  '02 Homelab/Guides/TrueNAS Build Guide.md': { publish: true, featured: 4, title: 'TrueNAS Build Guide', machine: 'bigrig', updated: '2026-10-17' },
  '02 Homelab/Guides/Pi-hole.md': { publish: true, title: 'Pi-hole', updated: '2026-10-10' },
  '02 Homelab/Hardware/Rack.md': { publish: true, title: 'Rack', updated: '2026-10-09' },
  '03 AI and Local Models/Benchmarks/Strata V100.md': { publish: true, featured: 7, title: 'Strata V100', machine: 'mac', updated: '2026-10-12' },
  '04 Programming/Regex.md': { publish: true, title: 'Regex', updated: '2026-01-01' },
  '07 Tools and Workflow/Private.md': { publish: false, title: 'Private' },
};

const LINKS = {
  '01 Projects/Penthouse/00 - Knowledge Hub.md': ['TrueNAS Build Guide', 'Wiring', 'Private', 'Nope'],
  '01 Projects/Strata/C.md': ['A'],
  '01 Projects/Strata/A.md': ['B'],
  '04 Programming/Regex.md': ['00 - Knowledge Hub'],
  '02 Homelab/Guides/Pi-hole.md': ['Rack', 'TrueNAS Build Guide', 'Pi-hole'],
  '02 Homelab/Hardware/Rack.md': ['Strata V100', 'Regex', 'Pi-hole'],
};

test('TOPICS carry lowercase labels and one colour each', () => {
  for (const t of L.TOPICS) {
    assert.equal(t.label, t.label.toLowerCase());
    assert.equal(t.description, t.description.toLowerCase());
    assert.match(L.topicColor(t.id), /^var\(--/);
  }
  assert.equal(L.topicColor('projects'), 'var(--terminal-blue)');
  assert.equal(L.topicColor('homelab'), 'var(--terminal-cyan)');
  assert.equal(L.topicColor('ai'), 'var(--terminal-green)');
  assert.equal(L.topicColor('linux'), 'var(--terminal-magenta)');
  assert.equal(L.topicColor('journals'), 'var(--terminal-yellow)');
  assert.equal(L.topicColor('tools'), 'var(--md-sys-color-primary)');
  assert.equal(L.topicColor('nope'), 'var(--md-sys-color-primary)');
});

test('accentStops: own topic first with at least half, others proportional to links both ways', () => {
  const idx = L.buildTitleIndex(META);
  const hub = L.accentStops('01 Projects/Penthouse/00 - Knowledge Hub.md', META, LINKS, idx);
  // out: homelab 1, projects 1 (Private and Nope drop); in: linux 1 (Regex)
  assert.deepEqual(hub, [{ id: 'projects', share: 0.5 }, { id: 'homelab', share: 0.25 }, { id: 'linux', share: 0.25 }]);
  assert.deepEqual(L.accentStops('01 Projects/Loose.md', META, LINKS, idx), [{ id: 'projects', share: 1 }]);
  // links only inside the topic stay solid
  assert.deepEqual(L.accentStops('01 Projects/Strata/C.md', META, LINKS, idx), [{ id: 'projects', share: 1 }]);
});

test('accentStops keeps at most three colours and drops self links', () => {
  const idx = L.buildTitleIndex(META);
  // Rack: out ai 1, linux 1, homelab 1 (Pi-hole); in homelab 1 (Pi-hole) → homelab 2, ai 1, linux 1 → own 0.5, then ai, linux tie broken by topic order; cap keeps own + 2
  const rack = L.accentStops('02 Homelab/Hardware/Rack.md', META, LINKS, idx);
  assert.deepEqual(rack, [{ id: 'homelab', share: 0.5 }, { id: 'benchmarks', share: 0.25 }, { id: 'linux', share: 0.25 }]);
  // Pi-hole: self link ignored; out homelab 2; in homelab 1 → solid
  assert.deepEqual(L.accentStops('02 Homelab/Guides/Pi-hole.md', META, LINKS, idx), [{ id: 'homelab', share: 1 }]);
});

test('accentCss renders a solid colour or a hard-stop vertical gradient', () => {
  assert.equal(L.accentCss([{ id: 'projects', share: 1 }]), 'var(--terminal-blue)');
  assert.equal(
    L.accentCss([{ id: 'projects', share: 0.5 }, { id: 'homelab', share: 0.25 }, { id: 'linux', share: 0.25 }]),
    'linear-gradient(180deg, var(--terminal-blue) 0% 50%, var(--terminal-cyan) 50% 75%, var(--terminal-magenta) 75% 100%)'
  );
  assert.equal(L.accentCss([]), 'var(--md-sys-color-primary)');
});

test('groupByFolder orders strip groups first, then by size, and labels folders like paths', () => {
  const idx = L.buildTitleIndex(META);
  const bucket = L.groupByTopic(META).get('projects');
  const groups = L.groupByFolder([...bucket.ranked, ...bucket.unranked], 'projects', META, LINKS, idx);
  assert.deepEqual(groups.map(g => [g.key, g.label, g.path, g.entries.length]), [
    ['Penthouse', 'penthouse/', '~/projects/penthouse', 2],
    ['Strata', 'strata/', '~/projects/strata', 5],
    ['', './', '~/projects', 1],
  ]);
});

test('groupByFolder keeps ranked notes first, then chains linked notes, then newest', () => {
  const idx = L.buildTitleIndex(META);
  const bucket = L.groupByTopic(META).get('projects');
  const groups = L.groupByFolder([...bucket.ranked, ...bucket.unranked], 'projects', META, LINKS, idx);
  assert.deepEqual(groups[0].entries.map(e => e.title), ['The Penthouse Rebuild Knowledge Hub', 'Wiring']);
  // C is newest → A (C links A) → B (A links B) → chain runs out → E then D by date
  assert.deepEqual(groups[1].entries.map(e => e.title), ['C', 'A', 'B', 'E', 'D']);
});

test('groupByFolder on a flat topic yields one root group', () => {
  const idx = L.buildTitleIndex(META);
  const bucket = L.groupByTopic(META).get('linux');
  const groups = L.groupByFolder([...bucket.ranked, ...bucket.unranked], 'linux', META, LINKS, idx);
  assert.deepEqual(groups.map(g => [g.key, g.label, g.path]), [['', './', '~/linux']]);
  assert.deepEqual(L.groupByFolder([], 'journals', META, LINKS, idx), []);
});

test('readerPath turns vault paths into a shell-looking path under the topic', () => {
  assert.equal(L.readerPath('01 Projects/Penthouse/00 - Knowledge Hub.md'), '~/projects/penthouse/00-knowledge-hub.md');
  assert.equal(L.readerPath('01 Projects/Penthouse'), '~/projects/penthouse');
  assert.equal(L.readerPath('04 Programming/Regex.md'), '~/linux/regex.md');
  assert.equal(L.readerPath(''), '~');
  assert.equal(L.readerPath('00 Index/Nope.md'), '~');
});

test('gardenFacts counts listable notes, non-empty topics, machines, strip, and the publish time', () => {
  const facts = L.gardenFacts({ generated_at: '2026-10-21T19:30:27Z', metadata: META });
  assert.deepEqual(facts, { notes: 13, topics: 4, machines: ['bigrig', 'mac'], featured: 3, generated: '2026-10-21T19:30:27Z' });
  assert.deepEqual(L.gardenFacts(null), { notes: 0, topics: 0, machines: [], featured: 0, generated: null });
});

test('shouldBoot runs once per session and never under reduced motion', () => {
  const store = (v) => ({ getItem: () => v });
  assert.equal(L.shouldBoot(store(null), false), true);
  assert.equal(L.shouldBoot(store('1'), false), false);
  assert.equal(L.shouldBoot(store(null), true), false);
  assert.equal(L.shouldBoot({ getItem() { throw new Error('blocked'); } }, false), true);
});
