const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../registration-config');
const qrFixture = fs.readFileSync(path.join(__dirname, 'fixtures/vietqr-payment.svg'), 'utf8');
const receiptFieldName = 'Hình ảnh xác thực đã thanh toán';

const originalFetch = global.fetch;
const envNames = ['LARK_APP_ID', 'LARK_APP_SECRET', 'LARK_BASE_TOKEN', 'LARK_TABLE_ID'];
const originalEnv = Object.fromEntries(envNames.map(key => [key, process.env[key]]));
const requestId = 'ed237ded-4e93-4a92-8a14-18b3bda12345';
let requests;
let createdRecords;
let schema;
let rejectCreate;
let rejectUpload;
let rejectQR;

function attendee(overrides = {}) {
  return {
    name: 'Nguyễn Văn Kiểm Thử', phone: '0900000000', email: 'test@example.com',
    company: 'Doanh nghiệp kiểm thử', title: 'Giám đốc',
    companySize: config.companySizes[0], stage: config.stages[1], industry: config.industries[3],
    connections: [config.connections[0]], quantity: config.quantities[1], attendeeType: 'paid',
    inviteCode: '', privacyConsent: config.privacyConsents[0], requestId, ...overrides
  };
}

beforeEach(() => {
  requests = [];
  createdRecords = new Map();
  rejectCreate = false;
  rejectUpload = false;
  rejectQR = false;
  schema = Object.entries(config.fieldIds).map(([key, id]) => ({ field_id: id, field_name: key, type: key === 'connections' ? 4 : 1 }));
  const choicesByField = {
    companySize: config.companySizes, stage: config.stages, industry: config.industries,
    connections: config.connections, quantity: config.quantities,
    payment: Object.values(config.paymentLabels), privacyConsent: config.privacyConsents
  };
  for (const [key, choices] of Object.entries(choicesByField)) {
    const field = schema.find(item => item.field_id === config.fieldIds[key]);
    field.type = key === 'connections' ? 4 : 3;
    field.property = { options: choices.map(name => ({ name })) };
  }
  schema.push({ field_id: config.receiptFieldId, field_name: receiptFieldName, type: 17 });
  envNames.forEach(key => { process.env[key] = 'test_value'; });
  for (const name of ['../lib/registration', '../lib/receipt', '../api/payment', '../api/receipt', '../api/register']) delete require.cache[require.resolve(name)];
  global.fetch = async (url, options) => {
    if (url.startsWith('https://img.vietqr.io/')) {
      requests.push({ url, options });
      return { ok: !rejectQR, text: async () => qrFixture };
    }
    const request = { url, options, body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body };
    requests.push(request);
    let result;
    if (url.endsWith('tenant_access_token/internal')) result = { code: 0, tenant_access_token: 'test_token', expire: 7200 };
    else if (url.includes('/fields?')) result = { code: 0, data: { items: schema, has_more: false } };
    else if (url.endsWith('drive/v1/medias/upload_all')) result = rejectUpload ? { code: 1061004 } : { code: 0, data: { file_token: 'test_receipt_token' } };
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

async function paidAttendee(overrides = {}) {
  const data = attendee({ paymentConfirmed: true, ...overrides });
  const png = PNG.sync.write(new PNG({ width: 2, height: 2 }));
  const result = await invoke('receipt', { ...data, receipt: { mime: 'image/png', base64: png.toString('base64') } });
  assert.equal(result.status, 200);
  return { ...data, receiptHandle: result.data.receiptHandle };
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
  assert.equal(result.data.memo, 'MACF2026 Nguyen Van Kiem Thu 0900000000');
  const apiURL = new URL(requests.find(request => request.url.startsWith('https://img.vietqr.io/')).url);
  assert.equal(apiURL.pathname, '/image/970416-621866-qr_only.svg');
  assert.equal(apiURL.searchParams.get('addInfo'), result.data.memo);
  assert.equal(apiURL.searchParams.get('amount'), '1000000');
  const png = PNG.sync.read(Buffer.from(result.data.qrDataURL.split(',')[1], 'base64'));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.ok(decoded, 'QR image must be independently decodable');
  let logoPixels = 0;
  for (let y = 225; y < 310; y++) {
    for (let x = 225; x < 310; x++) {
      const offset = (y * png.width + x) * 4;
      if (png.data[offset + 2] > png.data[offset] + 30) logoPixels++;
    }
  }
  assert.ok(logoPixels > 100, 'VMAA blue logo must be embedded in the QR image');
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

test('VietQR failure prevents displaying a payment QR', async () => {
  rejectQR = true;
  const result = await invoke('payment', attendee());
  assert.equal(result.status, 502);
  assert.match(result.data.error, /QR/);
});

test('transfer memo uses spaces and the full name within the VietQR limit', () => {
  const { validateRegistration } = require('../lib/registration');
  assert.equal(validateRegistration(attendee({ name: 'Đặng Văn-An', phone: '+84900000000' })).memo, 'MACF2026 Dang Van An 84900000000');
  assert.throws(() => validateRegistration(attendee({ name: 'Nguyen '.repeat(9) })), /50 ký tự/);
});

test('all ticket quantities calculate on the server', () => {
  const { validateRegistration } = require('../lib/registration');
  for (let i = 0; i < 5; i++) assert.equal(validateRegistration(attendee({ quantity: config.quantities[i], amount: 0 })).amount, (i + 1) * 500000);
});

test('privacy consent is explicit and preserves the selected sharing scope in Lark', async () => {
  const invalid = await invoke('payment', attendee({ privacyConsent: undefined }));
  assert.equal(invalid.status, 400);
  assert.equal(requests.length, 0);
  for (const privacyConsent of config.privacyConsents) {
    const { validateRegistration, recordFields } = require('../lib/registration');
    const data = validateRegistration(attendee({ privacyConsent }));
    assert.equal(recordFields(data, schema).privacyConsent, privacyConsent);
  }
});

test('changed Lark choices stop payment before displaying a QR', async () => {
  const field = schema.find(item => item.field_id === config.fieldIds.connections);
  field.property.options = [{ name: 'Nhu cầu kết nối mới' }];
  const result = await invoke('payment', attendee());
  assert.equal(result.status, 503);
  assert.equal(requests.some(request => request.url.startsWith('https://img.vietqr.io/')), false);
});

test('registration refreshes Lark choices after a receipt has been prepared', async () => {
  const data = await paidAttendee();
  schema = structuredClone(schema);
  schema.find(item => item.field_id === config.fieldIds.connections).property.options = [{ name: 'Nhu cầu kết nối mới' }];
  const result = await invoke('register', data);
  assert.equal(result.status, 503);
  assert.equal(createdRecords.size, 0);
  assert.equal(requests.filter(request => request.url.includes('/fields?')).length, 2);
});

test('other industry requires a description and maps it to the matching Base field', () => {
  const { validateRegistration, recordFields } = require('../lib/registration');
  assert.throws(() => validateRegistration(attendee({ industry: 'Khác' })), /lĩnh vực hoạt động/);
  const data = validateRegistration(attendee({ industry: 'Khác', industryOther: 'Năng lượng' }));
  assert.equal(recordFields(data, schema).industryOther, 'Năng lượng');
  assert.equal(validateRegistration(attendee({ industryOther: 'stale value' })).industryOther, '');
});

test('networking accepts multiple targets and requires a description for Other', async () => {
  const { validateRegistration, recordFields } = require('../lib/registration');
  for (const connectionsOther of [undefined, ' ', 'x'.repeat(201)]) {
    assert.throws(() => validateRegistration(attendee({ connections: ['Khác'], connectionsOther })), /doanh nghiệp bạn muốn kết nối/);
  }
  const connections = [config.connections[0], config.connections[4], 'Khác'];
  const data = validateRegistration(attendee({ connections: [...connections, connections[0]], connectionsOther: '  Nhà cung cấp công nghệ  ' }));
  const mapped = recordFields(data, schema);
  assert.deepEqual(mapped.connections, connections);
  assert.equal(mapped.connectionsOther, 'Nhà cung cấp công nghệ');
  assert.equal(validateRegistration(attendee({ connectionsOther: 'stale value' })).connectionsOther, '');
  assert.equal(recordFields(validateRegistration(attendee()), schema).connectionsOther, undefined);
  const result = await invoke('register', await paidAttendee({ connections, connectionsOther: 'Nhà cung cấp công nghệ' }));
  assert.equal(result.status, 200);
  assert.deepEqual(createdRecords.get(requestId).connections, connections);
  assert.equal(createdRecords.get(requestId).connectionsOther, 'Nhà cung cấp công nghệ');
  assert.deepEqual(createdRecords.get(requestId)[receiptFieldName], [{ file_token: 'test_receipt_token' }]);
});

test('obsolete session choices cannot be submitted as networking targets', async () => {
  const result = await invoke('payment', attendee({ connections: ['Tham dự toàn bộ chương trình'] }));
  assert.equal(result.status, 400);
  assert.equal(requests.length, 0);
});

test('VAT invoice information is optional and preserves multiline text in Lark', async () => {
  const { validateRegistration, recordFields } = require('../lib/registration');
  assert.equal(recordFields(validateRegistration(attendee()), schema).invoiceInfo, undefined);
  const invoiceInfo = 'DON VI KIEM THU\nMST 0000000000\nDia chi kiem thu\ntest@example.com';
  const data = await paidAttendee({ invoiceInfo: `  ${invoiceInfo}  ` });
  assert.equal((await invoke('register', data)).status, 200);
  assert.equal(createdRecords.get(requestId).invoiceInfo, invoiceInfo);
  assert.throws(() => validateRegistration(attendee({ invoiceInfo: 'x'.repeat(2001) })), /hóa đơn VAT/);
  assert.throws(() => validateRegistration(attendee({ invoiceInfo: {} })), /hóa đơn VAT/);
});

test('company invoice fields and additional notes are saved together in the existing Lark VAT field', async () => {
  const invoice = {
    invoiceTaxCode: '0110596988-001', invoiceName: 'CÔNG TY KIỂM THỬ',
    invoiceAddress: 'Địa chỉ doanh nghiệp', invoiceEmail: 'invoice@example.com',
    invoiceInfo: 'Ghi chú bổ sung\nDòng thứ hai'
  };
  const result = await invoke('register', await paidAttendee(invoice));
  assert.equal(result.status, 200);
  assert.equal(createdRecords.get(requestId).invoiceInfo, [
    'Mã số thuế: 0110596988001', 'Tên đơn vị: CÔNG TY KIỂM THỬ',
    'Địa chỉ: Địa chỉ doanh nghiệp', 'Email nhận hóa đơn: invoice@example.com',
    'Ghi chú bổ sung\nDòng thứ hai'
  ].join('\n'));
  assert.equal(createdRecords.get(requestId).invoiceTaxCode, undefined);
  const { validateRegistration } = require('../lib/registration');
  assert.throws(() => validateRegistration(attendee({ ...invoice, invoiceAddress: '' })), /địa chỉ/);
  assert.throws(() => validateRegistration(attendee({ ...invoice, invoiceTaxCode: 'invalid' })), /Mã số thuế/);
  assert.throws(() => validateRegistration(attendee({ ...invoice, invoiceEmail: 'invalid' })), /Email nhận hóa đơn/);
  assert.throws(() => validateRegistration(attendee({ ...invoice, invoiceInfo: 'x'.repeat(1950) })), /quá dài/);
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
  const data = await paidAttendee();
  assert.equal((await invoke('register', data)).status, 200);
  assert.equal((await invoke('register', data)).status, 200);
  assert.equal(createdRecords.size, 1);
  assert.deepEqual(createdRecords.get(requestId).connections, data.connections);
  assert.equal(createdRecords.get(requestId).payment, config.paymentLabels.paid);
  assert.equal(createdRecords.get(requestId).phone, data.phone);
  assert.deepEqual(createdRecords.get(requestId)[receiptFieldName], [{ file_token: 'test_receipt_token' }]);
  const uploads = requests.filter(request => request.url.endsWith('medias/upload_all'));
  assert.equal(uploads.length, 1, 'register retries reuse the uploaded receipt');
  assert.equal(uploads[0].body.get('parent_type'), 'bitable_image');
  assert.equal(uploads[0].body.get('parent_node'), process.env.LARK_BASE_TOKEN);
  assert.equal(uploads[0].body.get('file').type, 'image/png');
  assert.equal(uploads[0].body.get('file_name'), `vmaa-${requestId}.png`);
});

test('upstream failure never returns a successful registration', async () => {
  rejectCreate = true;
  const result = await invoke('register', await paidAttendee());
  assert.equal(result.status, 502);
  assert.equal(result.data.success, undefined);
});

test('paid registrations require a receipt uploaded for the exact attendee and request', async () => {
  assert.equal((await invoke('register', attendee({ paymentConfirmed: true }))).status, 400);
  const data = await paidAttendee();
  for (const overrides of [{ name: 'Người khác' }, { requestId: 'ed237ded-4e93-4a92-8a14-18b3bda12346' }, { receiptHandle: data.receiptHandle + 'x' }, { receiptHandle: 'forged.file_token' }]) {
    assert.equal((await invoke('register', { ...data, ...overrides })).status, 400);
  }
  assert.equal(createdRecords.size, 0);
});

test('receipt uploads reject unsupported, oversized and mislabelled files', async () => {
  const data = attendee({ paymentConfirmed: true });
  const png = PNG.sync.write(new PNG({ width: 2, height: 2 }));
  for (const receipt of [undefined, { mime: 'image/png', base64: Buffer.from('<svg/>').toString('base64') }, { mime: 'image/jpeg', base64: png.toString('base64') }, { mime: 'image/png', base64: '%%%' }]) {
    assert.equal((await invoke('receipt', { ...data, receipt })).status, 400);
  }
  assert.equal((await invoke('receipt', { ...data, receipt: { mime: 'image/png', base64: Buffer.alloc(config.maxReceiptBytes + 1).toString('base64') } })).status, 413);
  assert.equal(requests.length, 0);
});

test('failed receipt upload cannot create a registration', async () => {
  rejectUpload = true;
  const png = PNG.sync.write(new PNG({ width: 2, height: 2 }));
  const result = await invoke('receipt', attendee({ paymentConfirmed: true, receipt: { mime: 'image/png', base64: png.toString('base64') } }));
  assert.equal(result.status, 502);
  assert.equal(result.data.receiptHandle, undefined);
  assert.equal(createdRecords.size, 0);
});

test('a changed receipt column blocks QR before payment', async () => {
  schema = schema.filter(field => field.type !== 17);
  assert.equal((await invoke('payment', attendee())).status, 503);
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
  for (const override of [{ phone: '123' }, { email: 'invalid' }, { connections: [] }, { quantity: '6 vé' }, { attendeeType: 'invalid' }]) {
    assert.equal((await invoke('payment', attendee(override))).status, 400);
  }
  assert.equal((await invoke('payment', '{broken')).status, 400);
  assert.equal((await invoke('payment', attendee(), { headers: { host: 'localhost:4173', origin: 'https://unrelated.example', 'content-type': 'application/json' } })).status, 403);
  assert.equal((await invoke('payment', attendee(), { method: 'GET' })).status, 405);
  assert.equal(createdRecords.size, 0);
});
