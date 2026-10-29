import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.validation-fix-2.mjs';

function mockKrakenOHLC() {
  const intervalMs = 60 * 60 * 1000;
  const currentBucket = Math.floor(Date.now() / intervalMs) * intervalMs;
  const rows = [];
  for (let i = 250; i >= 1; i--) {
    const t = currentBucket - i * intervalMs;
    const close = 30000 + (250 - i) * 12 + Math.sin(i / 5) * 120;
    rows.push([String(Math.floor(t / 1000)), String(close - 10), String(close + 30), String(close - 35), String(close), '1', '100']);
  }
  rows.push([String(Math.floor(currentBucket / 1000)), '33000', '33100', '32900', '33050', '1', '100']);
  return { error: [], result: { XXBTZUSD: rows, last: 'ignored' } };
}

test('health stays read-only and never supports orders', async () => {
  const response = await worker.fetch(new Request('https://unit.test/health'));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.mode, 'read-only');
  assert.equal(data.executionEnabled, false);
  assert.equal(data.ordersSupported, false);
  assert.equal(data.version, 'validation-fix-2');
});

test('research excludes the currently forming OHLC candle', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(mockKrakenOHLC()), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
  try {
    const response = await worker.fetch(new Request('https://unit.test/research?pair=XBTUSD&interval=60'));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true, JSON.stringify(data));
    assert.equal(data.executionEnabled, false);
    assert.equal(data.ordersSupported, false);
    assert.equal(data.excludedOpenCandles, 1);
    assert.equal(data.bars, 250);
    assert.equal(data.intervalMinutes, 60);
    assert.equal(data.validationStartIndex, data.trainingBars);
    assert.equal(data.validationBars, data.bars - data.trainingBars);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
