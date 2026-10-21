// tests/net-utils.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

// net-utils.js attaches to window; give it one and a fetch we control.
global.window = {};
let fetchCalls = 0;
global.fetch = async () => { fetchCalls += 1; return new Response('{"n":1}', { status: 200 }); };
require('../net-utils.js');
const { fetchJson } = global.window.netUtils;

test('concurrent de-duplicated GETs each get a readable body', async () => {
  fetchCalls = 0;
  const [a, b] = await Promise.all([
    fetchJson('https://example.test/manifest.json', {}, { retries: 0 }),
    fetchJson('https://example.test/manifest.json', {}, { retries: 0 }),
  ]);
  assert.deepEqual(a, { n: 1 });
  assert.deepEqual(b, { n: 1 });
  assert.equal(fetchCalls, 1);
});
