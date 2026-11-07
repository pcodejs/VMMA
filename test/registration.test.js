const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');
const config = require('../registration-config');

const originalFetch = global.fetch;
const envNames = ['LARK_APP_ID', 'LARK_APP_SECRET', 'LARK_BASE_TOKEN', 'LARK_TABLE_ID'];
const originalEnv = Object.fromEntries(envNames.map(key => [key, process.env[key]]));
const requestId = 'ed237ded-4e93-4a92-8a14-18b3bda12345';
let requests;
let createdRecords;
let schema;
let rejectCreate;

function attendee(overrides = {}) {
  return {
    name: 'Nguyễn Văn Kiểm Thử', phone: '0900000000', email: 'test@example.com',
    company: 'Doanh nghiệp kiểm thử', title: 'Giám đốc',
    companySize: config.companySizes[0], stage: config.stages[1], industry: config.industries[3],
    sessions: [config.sessions[0]], quantity: config.quantities[1], attendeeType: 'paid',
    inviteCode: '', requestId, ...overrides
  };
}

beforeEach(() => {
  requests = [];
  createdRecords = new Map();
  rejectCreate = false;
  schema = Object.entries(config.fieldIds).map(([key, id]) => ({ field_id: id, field_name: key, type: key === 'sessions' ? 4 : 1 }));
  envNames.forEach(key => { process.env[key] = 'test_value'; });
  for (const name of ['../lib/registration', '../api/payment', '../api/register']) delete require.cache[require.resolve(name)];
  global.fetch = async (url, options) => {
    const request = { url, options, body: options.body ? JSON.parse(options.body) : null };
    requests.push(request);
    let result;
    if (url.endsWith('tenant_access_token/internal')) result = { code: 0, tenant_access_token: 'test_token', expire: 7200 };
    else if (url.includes('/fields?')) result = { code: 0, data: { items: schema, has_more: false } };
    else if (url.includes('/records?')) {
      if (rejectCreate) result = { code: 1254302 };
      else {
        const token = new URL(url).searchParams.get('client_token');
        if (!createdRecords.has(token)) createdRecords.set(token, request.body.fields);
        result = { code: 0, data: { record: { record_id: 'test_record' } } };
      }
    } else throw new Error('Unexpected upstream request in test');
    return { ok: true, json: async () => result };
  };
});

afterEach(() => {
  global.fetch = originalFetch;
  for (const key of envNames) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

async function invoke(endpoint, body, overrides = {}) {
  const req = { method: 'POST', headers: { 'content-type': 'application/json', host: 'localhost:4173', origin: 'http://localhost:4173' }, body, ...overrides };
  const result = { headers: {} };
  const res = {
    setHeader(key, value) { result.headers[key] = value; },
    status(code) { result.status = code; return this; },
    json(data) { result.data = data; }
  };
  await require(`../api/${endpoint}`)(req, res);
  return result;
}

function fields(payload) {
  const result = {};
  for (let offset = 0; offset < payload.length;) {
    const key = payload.slice(offset, offset + 2);
    const length = Number(payload.slice(offset + 2, offset + 4));
    result[key] = payload.slice(offset + 4, offset + 4 + length);
    offset += 4 + length;
  }
  return result;
}

test('the rendered QR decodes to the exact ACB account, ticket total and memo', async () => {
  const result = await invoke('payment', attendee({ amount: 1 }));
  assert.equal(result.status, 200);
  assert.equal(result.data.amount, 1000000);
  assert.equal(result.data.memo, 'VMAA - Nguyen Van Kiem Thu - 0900000000');
  const png = PNG.sync.read(Buffer.from(result.data.qrDataURL.split(',')[1], 'base64'));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.ok(decoded, 'QR image must be independently decodable');
  const payload = fields(decoded.data);
  const provider = fields(payload['38']);
  assert.equal(fields(provider['01'])['00'], '970416');
  assert.equal(fields(provider['01'])['01'], '621866');
  assert.equal(provider['02'], 'QRIBFTTA');
  assert.equal(payload['54'], '1000000');
  assert.equal(fields(payload['62'])['08'], result.data.memo);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(createdRecords.size, 0);
});

test('all ticket quantities calculate on the server', () => {
  const { validateRegistration } = require('../lib/registration');
  for (let i = 0; i < 5; i++) assert.equal(validateRegistration(attendee({ quantity: config.quantities[i], amount: 0 })).amount, (i + 1) * 500000);
});

test('guest and bulk registrations skip the transfer and keep the correct Lark status', async () => {
  for (const override of [{ attendeeType: 'guest' }, { quantity: config.quantities[5] }]) {
    const payment = await invoke('payment', attendee(override));
    assert.equal(payment.status, 200);
    assert.equal(payment.data.amount, 0);
    assert.equal(payment.data.qrDataURL, null);
    const registration = await invoke('register', attendee({ ...override, requestId: override.attendeeType ? requestId : 'ed237ded-4e93-4a92-8a14-18b3bda12346' }));
    assert.equal(registration.status, 200);
  }
  assert.equal([...createdRecords.values()][0].payment, config.paymentLabels.guest);
  assert.equal([...createdRecords.values()][1].payment, config.paymentLabels.bulk);
});

test('a normal registration requires an explicit transfer confirmation', async () => {
  const result = await invoke('register', attendee({ paymentConfirmed: false }));
  assert.equal(result.status, 400);
  assert.equal(createdRecords.size, 0);
  assert.equal(requests.length, 0);
});

test('retries keep the same Lark idempotency token and exact field mapping', async () => {
  const data = attendee({ paymentConfirmed: true });
  assert.equal((await invoke('register', data)).status, 200);
  assert.equal((await invoke('register', data)).status, 200);
  assert.equal(createdRecords.size, 1);
  assert.deepEqual(createdRecords.get(requestId).sessions, data.sessions);
  assert.equal(createdRecords.get(requestId).payment, config.paymentLabels.paid);
  assert.equal(createdRecords.get(requestId).phone, data.phone);
});

test('upstream failure never returns a successful registration', async () => {
  rejectCreate = true;
  const result = await invoke('register', attendee({ paymentConfirmed: true }));
  assert.equal(result.status, 502);
  assert.equal(result.data.success, undefined);
});

test('missing Lark configuration blocks the QR before payment', async () => {
  delete process.env.LARK_APP_SECRET;
  const result = await invoke('payment', attendee());
  assert.equal(result.status, 503);
  assert.equal(result.data.qrDataURL, undefined);
  assert.equal(requests.length, 0);
});

test('changed Base schema blocks payment rather than accepting an incomplete mapping', async () => {
  schema = schema.slice(1);
  const result = await invoke('payment', attendee());
  assert.equal(result.status, 503);
  assert.equal(result.data.qrDataURL, undefined);
});

test('invalid input, malformed JSON and cross-origin requests are rejected', async () => {
  for (const override of [{ phone: '123' }, { email: 'invalid' }, { sessions: [] }, { quantity: '6 vé' }, { attendeeType: 'invalid' }]) {
    assert.equal((await invoke('payment', attendee(override))).status, 400);
  }
  assert.equal((await invoke('payment', '{broken')).status, 400);
  assert.equal((await invoke('payment', attendee(), { headers: { host: 'localhost:4173', origin: 'https://unrelated.example', 'content-type': 'application/json' } })).status, 403);
  assert.equal((await invoke('payment', attendee(), { method: 'GET' })).status, 405);
  assert.equal(createdRecords.size, 0);
});
