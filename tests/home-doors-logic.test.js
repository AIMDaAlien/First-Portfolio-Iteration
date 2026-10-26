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

test('panBy limits: viewport edge when small, zoom growth when zoomed', () => {
  const b = { w: 800, h: 400, vw: 1000, vh: 800 };
  // smaller than the viewport: it may move until it touches the viewport's edge
  assert.deepEqual(D.panBy({ s: 1, x: 0, y: 0 }, 300, 300, b), { s: 1, x: 100, y: 200 });
  // zoomed: it may also move by as much as zooming grew it, w*(s-1)/2, so a zoom
  // anchored anywhere on the image is always reachable
  const p = D.panBy({ s: 2, x: 0, y: 0 }, 1000, -1000, b);
  assert.equal(p.x, 400);   // max((1600 - 1000) / 2, 800 / 2)
  assert.equal(p.y, -200);  // max(0, 400 / 2)
});

test('zooming in steps from 1x keeps the point under the cursor fixed', () => {
  // a wide chart, as every lab chart is: shorter than the viewport at first
  const b = { w: 1314, h: 738, vw: 1440, vh: 900 };
  const px = 280, py = -150;          // cursor, from the viewport centre
  let st = { s: 1, x: 0, y: 0 };
  for (let i = 0; i < 6; i++) st = D.panBy(D.zoomAt(st, 1.15, px, py), 0, 0, b);
  // the image point first under the cursor was (px, py); it must still be there
  assert.ok(Math.abs(st.x + st.s * px - px) < 1e-6, `x drift ${st.x + st.s * px - px}`);
  assert.ok(Math.abs(st.y + st.s * py - py) < 1e-6, `y drift ${st.y + st.s * py - py}`);
});
