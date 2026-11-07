const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/tax-code');
const originalFetch = global.fetch;

afterEach(() => { global.fetch = originalFetch; });

async function lookup(taxCode) {
  const result = {};
  const req = {
    method: 'POST', headers: { 'content-type': 'application/json', host: 'localhost', origin: 'http://localhost' },
    body: { taxCode }
  };
  await handler(req, {
    setHeader() {},
    status(code) { result.status = code; return this; },
    json(data) { result.data = data; }
  });
  return result;
}

test('tax lookup normalizes company and branch codes and returns only the matching invoice information', async () => {
  for (const taxCode of ['0110 596 988', '0316794479-001']) {
    const normalized = taxCode.replace(/[\s-]/g, '');
    global.fetch = async (url, options) => {
      assert.equal(url, `https://api.vietqr.io/v2/business/${normalized}`);
      assert.ok(options.signal);
      return { ok: true, json: async () => ({ code: '00', data: {
        id: normalized, name: ' CÔNG TY KIỂM THỬ ', address: ' Địa chỉ kiểm thử ', unrelated: 'excluded'
      } }) };
    };
    const result = await lookup(taxCode);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { taxCode: normalized, name: 'CÔNG TY KIỂM THỬ', address: 'Địa chỉ kiểm thử' });
  }
});

test('invalid tax input is rejected before contacting the provider', async () => {
  global.fetch = async () => { throw new Error('Provider must not be called'); };
  for (const taxCode of ['', '123', '123456789012', {}, 'https://example.com']) {
    assert.equal((await lookup(taxCode)).status, 400);
  }
});

test('missing, mismatched and unavailable company data never return a successful lookup', async () => {
  for (const code of ['51', '52']) {
    global.fetch = async () => ({ ok: true, json: async () => ({ code }) });
    assert.equal((await lookup('0110596988')).status, 404);
  }
  for (const data of [undefined, { id: '0316794479', name: 'Wrong company', address: 'Wrong address' }, { id: '0110596988', name: 'Missing address' }]) {
    global.fetch = async () => ({ ok: true, json: async () => ({ code: '00', data }) });
    assert.equal((await lookup('0110596988')).status, 502);
  }
  global.fetch = async () => ({ ok: false, status: 429 });
  assert.equal((await lookup('0110596988')).status, 503);
  global.fetch = async () => { throw new Error('Timeout'); };
  assert.equal((await lookup('0110596988')).status, 503);
});
