// tests/home-doors-logic.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../home-doors-logic.js');

test('pickDoor: url wins, then storage, then short', () => {
  assert.equal(D.pickDoor('?door=deep', 'short'), 'deep');
  assert.equal(D.pickDoor('', 'deep'), 'deep');
  assert.equal(D.pickDoor('', null), 'short');
});

test('pickDoor ignores unknown values', () => {
  assert.equal(D.pickDoor('?door=DEEP', null), 'short');
  assert.equal(D.pickDoor('?door=x', 'deep'), 'deep');
  assert.equal(D.pickDoor('?door=', 'nope'), 'short');
});

test('doorSearch sets door=deep, drops it for short, keeps other params', () => {
  assert.equal(D.doorSearch('', 'deep'), '?door=deep');
  assert.equal(D.doorSearch('?door=deep', 'short'), '');
  assert.equal(D.doorSearch('?ref=li&door=deep', 'short'), '?ref=li');
  assert.equal(D.doorSearch('?ref=li', 'deep'), '?ref=li&door=deep');
});

test('doorForHash maps sections to their door', () => {
  assert.equal(D.doorForHash('#machine-spec'), 'deep');
  assert.equal(D.doorForHash('#lab'), 'deep');
  assert.equal(D.doorForHash('#about'), 'short');
  assert.equal(D.doorForHash('#garden-invite'), 'short');
  assert.equal(D.doorForHash('#contact'), null);
  assert.equal(D.doorForHash(''), null);
});

test('clampZoom keeps 1..6', () => {
  assert.equal(D.clampZoom(0.2), 1);
  assert.equal(D.clampZoom(9), 6);
  assert.equal(D.clampZoom(2.5), 2.5);
});

test('zoomAt keeps the point under the cursor fixed', () => {
  const s1 = D.zoomAt({ s: 1, x: 0, y: 0 }, 2, 100, 50);
  assert.equal(s1.s, 2);
  // screen point = x + s * imagePoint; the image point under (100,50) at s=1 was (100,50)
  assert.equal(s1.x + 2 * 100, 100);
  assert.equal(s1.y + 2 * 50, 50);
});

test('zoomAt back to 1 recentres', () => {
  assert.deepEqual(D.zoomAt({ s: 2, x: -100, y: -40 }, 0.1, 0, 0), { s: 1, x: 0, y: 0 });
});

test('panBy stays inside the scaled image', () => {
  const b = { w: 800, h: 400, vw: 1000, vh: 800 };
  assert.deepEqual(D.panBy({ s: 1, x: 0, y: 0 }, 300, 300, b), { s: 1, x: 0, y: 0 });
  const p = D.panBy({ s: 2, x: 0, y: 0 }, 1000, -1000, b);
  assert.equal(p.x, 300);   // (1600 - 1000) / 2
  assert.equal(p.y, 0);     // 800 <= 800, no room
});
