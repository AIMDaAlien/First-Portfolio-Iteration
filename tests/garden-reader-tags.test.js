// tests/garden-reader-tags.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../garden-reader-logic.js');

const META = {
  '02 Homelab/Raspberry Pi/Pi-hole Migration.md': { publish: true, featured: 5, title: 'Pi-hole Migration', tags: ['pihole', 'raspberry-pi', 'dns'], updated: '2026-10-20' },
  '02 Homelab/Raspberry Pi/Pi-hole Setup.md': { publish: true, title: 'Pi-hole Setup', tags: ['Pihole', 'guide'], updated: '2026-10-17' },
  '02 Homelab/Hardware/Raspberry Pi B+ Utility Node.md': { publish: true, machine: 'bigrig', title: 'B+ Utility Node', tags: ['raspberry-pi', 'hardware'], updated: '2026-09-23' },
  '03 AI and Local Models/Benchmarks/v4.md': { publish: true, machine: 'bigrig', title: 'v4', tags: ['benchmarks', 'llama-cpp'], updated: '2026-09-24' },
  '03 AI and Local Models/Mac - MLX/Gemma.md': { publish: true, title: 'Gemma', tags: '#Benchmarking', updated: '2026-10-02' },
  '01 Projects/Strata/Bench.md': { publish: true, title: 'Strata Bench', tags: ['benchmark', 'llama.cpp', 'guide'], updated: '2026-10-10' },
  '07 Tools and Workflow/Private.md': { publish: false, title: 'Private', tags: ['pihole'] },
};

test('tags normalise case, a leading #, and known variants', () => {
  assert.equal(L.normalizeTag(' Pihole '), 'pihole');
  assert.equal(L.normalizeTag('#Benchmarking'), 'benchmark');
  assert.equal(L.normalizeTag('benchmarks'), 'benchmark');
  assert.equal(L.normalizeTag('llama-cpp'), 'llama.cpp');
  assert.equal(L.normalizeTag('network'), 'networking');
  assert.equal(L.normalizeTag('self-hosted'), 'self-hosting');
  assert.equal(L.normalizeTag(''), '');
});

test('tagsOf reads arrays or a single string, normalised and deduplicated', () => {
  assert.deepEqual(L.tagsOf({ tags: ['Benchmark', 'benchmarks', 'gpu'] }), ['benchmark', 'gpu']);
  assert.deepEqual(L.tagsOf({ tags: '#Benchmarking' }), ['benchmark']);
  assert.deepEqual(L.tagsOf({}), []);
  assert.equal(L.isBenchmarkTagged({ tags: 'benchmarking' }), true);
});

test('tagIndex maps each tag to its published notes, best ranked first', () => {
  const idx = L.tagIndex(META);
  assert.deepEqual(idx.get('pihole'), ['02 Homelab/Raspberry Pi/Pi-hole Migration.md', '02 Homelab/Raspberry Pi/Pi-hole Setup.md']);
  assert.deepEqual(idx.get('benchmark'), ['01 Projects/Strata/Bench.md', '03 AI and Local Models/Mac - MLX/Gemma.md', '03 AI and Local Models/Benchmarks/v4.md']);
  assert.deepEqual(idx.get('raspberry-pi'), ['02 Homelab/Raspberry Pi/Pi-hole Migration.md', '02 Homelab/Hardware/Raspberry Pi B+ Utility Node.md']);
});

test('?tag= links round-trip', () => {
  assert.equal(L.tagHref('llama.cpp'), '?tag=llama.cpp');
  assert.equal(L.tagFromSearch('?tag=raspberry-pi'), 'raspberry-pi');
  assert.equal(L.tagFromSearch('?tag=%23Benchmarks'), 'benchmark');
  assert.equal(L.tagFromSearch('?note=x.md'), null);
});

test('notes sharing rarer tags rank first, and the note itself is left out', () => {
  const idx = L.tagIndex(META);
  const shared = L.sharedTagNotes('02 Homelab/Raspberry Pi/Pi-hole Migration.md', META, idx, 5);
  assert.deepEqual(shared, ['02 Homelab/Hardware/Raspberry Pi B+ Utility Node.md', '02 Homelab/Raspberry Pi/Pi-hole Setup.md']);
  const bench = L.sharedTagNotes('01 Projects/Strata/Bench.md', META, idx, 5);
  assert.equal(bench[0], '03 AI and Local Models/Benchmarks/v4.md');
  assert.deepEqual(L.sharedTagNotes('01 Projects/Strata/Bench.md', META, idx, 1).length, 1);
});
