// tests/garden-reader-operator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../garden-reader-logic.js');

const META = {
  '01 Projects/Strata/Strata Bench.md': { publish: true, title: 'Strata Bench', tags: ['strata', 'benchmark'], updated: '2026-10-10' },
  '01 Projects/Strata/Plain.md': { publish: true, title: 'Plain', tags: ['strata'], updated: '2026-10-09' },
  '03 AI and Local Models/Benchmarks/v4 Results.md': { publish: true, featured: 10, title: 'v4 Results', tags: ['benchmark'], updated: '2026-09-24' },
  '03 AI and Local Models/Benchmarks/ReBench/run-1.md': { publish: true, title: 'run 1', updated: '2026-09-20' },
  '03 AI and Local Models/Models & Serving/Flash.md': { publish: true, title: 'Flash', tags: 'benchmarks', updated: '2026-10-01' },
  '03 AI and Local Models/Mac - MLX/Gemma.md': { publish: true, title: 'Gemma', updated: '2026-10-02' },
  '02 Homelab/Guides/Pi-hole.md': { publish: true, title: 'Pi-hole', updated: '2026-10-03' },
  '07 Tools and Workflow/Private.md': { publish: false, title: 'Private' },
};

test('benchmarks is its own topic, after ai, with its own colour', () => {
  assert.deepEqual(L.TOPICS.map(t => t.id), ['projects', 'homelab', 'ai', 'benchmarks', 'linux', 'journals', 'tools']);
  const b = L.TOPICS.find(t => t.id === 'benchmarks');
  assert.equal(b.label, 'benchmarks');
  assert.equal(L.TOPICS.find(t => t.id === 'ai').label, 'ai and local models');
  assert.equal(L.topicColor('benchmarks'), 'var(--terminal-orange)');
});

test('notes in the Benchmarks folder belong to benchmarks, the rest of AI stays ai', () => {
  assert.equal(L.topicForPath('03 AI and Local Models/Benchmarks/v4 Results.md').id, 'benchmarks');
  assert.equal(L.topicForPath('03 AI and Local Models/Benchmarks/ReBench/run-1.md').id, 'benchmarks');
  assert.equal(L.topicForPath('03 AI and Local Models/Mac - MLX/Gemma.md').id, 'ai');
  assert.equal(L.topicForPath('01 Projects/Strata/Strata Bench.md').id, 'projects');
});

test('readerPath and folder groups drop the Benchmarks folder itself', () => {
  assert.equal(L.readerPath('03 AI and Local Models/Benchmarks/v4 Results.md'), '~/benchmarks/v4-results.md');
  assert.equal(L.readerPath('03 AI and Local Models/Benchmarks/ReBench/run-1.md'), '~/benchmarks/rebench/run-1.md');
  assert.equal(L.readerPath('03 AI and Local Models/Mac - MLX/Gemma.md'), '~/ai/mac-mlx/gemma.md');
  const entries = L.groupByTopic(META).get('benchmarks');
  const groups = L.groupByFolder(entries.ranked.concat(entries.unranked), 'benchmarks', META, {}, L.buildTitleIndex(META));
  assert.deepEqual(groups.map(g => g.label), ['./', 'rebench/']);
  assert.equal(groups[1].path, '~/benchmarks/rebench');
});

test('isBenchmarkTagged accepts benchmark tags as a list or a string', () => {
  assert.equal(L.isBenchmarkTagged(META['01 Projects/Strata/Strata Bench.md']), true);
  assert.equal(L.isBenchmarkTagged(META['03 AI and Local Models/Models & Serving/Flash.md']), true);
  assert.equal(L.isBenchmarkTagged(META['01 Projects/Strata/Plain.md']), false);
  assert.equal(L.isBenchmarkTagged(undefined), false);
});

test('a benchmark-tagged note outside benchmarks mixes benchmark orange into its bar', () => {
  const idx = L.buildTitleIndex(META);
  const stops = L.accentStops('01 Projects/Strata/Strata Bench.md', META, {}, idx);
  assert.equal(stops[0].id, 'projects');
  assert.ok(stops[0].share >= 0.5);
  assert.equal(stops[1].id, 'benchmarks');
  assert.ok(Math.abs(stops.reduce((s, x) => s + x.share, 0) - 1) < 1e-9);
  assert.deepEqual(L.accentStops('01 Projects/Strata/Plain.md', META, {}, idx), [{ id: 'projects', share: 1 }]);
  assert.deepEqual(L.accentStops('03 AI and Local Models/Benchmarks/v4 Results.md', META, {}, idx), [{ id: 'benchmarks', share: 1 }]);
});

test('topicLoad counts listable notes per topic, largest first, with a share of the largest', () => {
  const load = L.topicLoad(META);
  assert.deepEqual(load.map(t => [t.id, t.count]), [['projects', 2], ['ai', 2], ['benchmarks', 2], ['homelab', 1]]);
  assert.equal(load[0].share, 1);
  assert.equal(load[3].share, 0.5);
  assert.equal(load[2].label, 'benchmarks');
});
