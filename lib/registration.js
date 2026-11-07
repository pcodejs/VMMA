const config = require('../registration-config');

class RegistrationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function validateRegistration(input, requirePayment = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RegistrationError('Thông tin đăng ký không hợp lệ.');
  const data = {};
  for (const [key, label] of Object.entries({ name: 'Họ và tên', phone: 'Số điện thoại', email: 'Email công việc', company: 'Công ty / Tổ chức', title: 'Chức danh' })) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].trim().length > 200) throw new RegistrationError(`Vui lòng kiểm tra ${label.toLowerCase()}.`);
    data[key] = input[key].trim().replace(/\s+/g, ' ');
  }
  data.phone = data.phone.replace(/[\s().-]/g, '');
  if (!/^(?:\+?[1-9]\d{7,14}|0\d{8,10})$/.test(data.phone)) throw new RegistrationError('Số điện thoại chưa đúng định dạng.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new RegistrationError('Email công việc chưa đúng định dạng.');
  for (const [key, choices] of Object.entries({ companySize: config.companySizes, stage: config.stages, industry: config.industries, quantity: config.quantities })) {
    if (!choices.includes(input[key])) throw new RegistrationError('Vui lòng chọn đầy đủ thông tin doanh nghiệp và số lượng vé.');
    data[key] = input[key];
  }
  if (!Array.isArray(input.sessions) || !input.sessions.length || input.sessions.some(value => !config.sessions.includes(value))) throw new RegistrationError('Vui lòng chọn phiên muốn tham dự.');
  data.sessions = [...new Set(input.sessions)];
  if (!['paid', 'guest'].includes(input.attendeeType)) throw new RegistrationError('Vui lòng chọn hình thức tham dự.');
  data.attendeeType = input.attendeeType;
  data.inviteCode = typeof input.inviteCode === 'string' ? input.inviteCode.trim() : '';
  if (data.inviteCode.length > 100) throw new RegistrationError('Mã mời quá dài.');
  data.isBulk = data.quantity === config.quantities[5];
  data.amount = data.attendeeType === 'guest' || data.isBulk ? 0 : (config.quantities.indexOf(data.quantity) + 1) * config.price;
  data.payment = data.attendeeType === 'guest' ? config.paymentLabels.guest : data.isBulk ? config.paymentLabels.bulk : config.paymentLabels.paid;
  if (requirePayment && data.amount > 0 && input.paymentConfirmed !== true) throw new RegistrationError('Vui lòng xác nhận đã chuyển khoản trước khi gửi đăng ký.');
  data.memo = `VMAA - ${data.name} - ${data.phone}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  if (data.amount > 0 && (!/^[\x20-\x7e]+$/.test(data.memo) || data.memo.length > 95)) throw new RegistrationError('Họ tên hoặc số điện thoại quá dài để tạo nội dung chuyển khoản. Vui lòng liên hệ Ban Tổ chức.');
  return data;
}

let tokenCache;
let fieldsCache;

async function larkRequest(path, options = {}) {
  const response = await fetch(`https://open.larksuite.com/open-apis/${path}`, { ...options, signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || result.code !== 0) {
    const error = new RegistrationError('Kênh đăng ký đang gặp gián đoạn. Vui lòng thử lại hoặc liên hệ Ban Tổ chức.', 502);
    error.upstreamCode = result.code;
    throw error;
  }
  return result;
}

async function getLarkContext() {
  const { LARK_APP_ID, LARK_APP_SECRET, LARK_BASE_TOKEN, LARK_TABLE_ID } = process.env;
  if (![LARK_APP_ID, LARK_APP_SECRET, LARK_BASE_TOKEN, LARK_TABLE_ID].every(Boolean)) throw new RegistrationError('Kênh đăng ký đang được kết nối. Vui lòng liên hệ Ban Tổ chức qua 0913.989.365.', 503);
  if (!tokenCache || tokenCache.expires < Date.now()) {
    const result = await larkRequest('auth/v3/tenant_access_token/internal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: LARK_APP_ID, app_secret: LARK_APP_SECRET })
    });
    tokenCache = { value: result.tenant_access_token, expires: Date.now() + (result.expire - 120) * 1000 };
  }
  const tablePath = `bitable/v1/apps/${encodeURIComponent(LARK_BASE_TOKEN)}/tables/${encodeURIComponent(LARK_TABLE_ID)}`;
  const headers = { Authorization: `Bearer ${tokenCache.value}`, 'Content-Type': 'application/json' };
  if (!fieldsCache || fieldsCache.expires < Date.now() || fieldsCache.path !== tablePath) {
    const fields = [];
    let pageToken = '';
    do {
      const query = new URLSearchParams({ page_size: '100' });
      if (pageToken) query.set('page_token', pageToken);
      const result = await larkRequest(`${tablePath}/fields?${query}`, { headers });
      fields.push(...result.data.items);
      pageToken = result.data.has_more ? result.data.page_token : '';
    } while (pageToken);
    fieldsCache = { fields, path: tablePath, expires: Date.now() + 300000 };
  }
  for (const fieldId of Object.values(config.fieldIds)) {
    if (!fieldsCache.fields.some(field => field.field_id === fieldId)) throw new RegistrationError('Biểu mẫu vừa được cập nhật. Vui lòng liên hệ Ban Tổ chức để hoàn tất đăng ký.', 503);
  }
  return { headers, tablePath, fields: fieldsCache.fields };
}

function recordFields(data, schema) {
  const fields = {};
  for (const [key, fieldId] of Object.entries(config.fieldIds)) {
    const field = schema.find(item => item.field_id === fieldId);
    let value = data[key];
    if (value === '') continue;
    if (field.type === 4 && !Array.isArray(value)) value = [value];
    if (field.type !== 4 && Array.isArray(value)) {
      if (field.type === 1) value = value.join('\n');
      else if (value.length === 1) value = value[0];
      else throw new RegistrationError('Lựa chọn phiên tham dự chưa khớp cấu hình Lark. Vui lòng liên hệ Ban Tổ chức.', 503);
    }
    fields[field.field_name] = value;
  }
  return fields;
}

function requestBody(req) {
  if (req.method !== 'POST') throw new RegistrationError('Phương thức không được hỗ trợ.', 405);
  const origin = req.headers.origin;
  if (origin) {
    let originHost;
    try { originHost = new URL(origin).host; } catch { throw new RegistrationError('Nguồn gửi biểu mẫu không hợp lệ.', 403); }
    if (originHost !== req.headers.host) throw new RegistrationError('Nguồn gửi biểu mẫu không hợp lệ.', 403);
  }
  if (!req.headers['content-type']?.includes('application/json')) throw new RegistrationError('Định dạng dữ liệu không hợp lệ.', 415);
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { throw new RegistrationError('Thông tin đăng ký không hợp lệ.'); }
  }
  if (JSON.stringify(body || {}).length > 16000) throw new RegistrationError('Thông tin đăng ký quá dài.', 413);
  return body;
}

function sendError(res, error) {
  console.error('registration_error', { status: error.status || 500, upstreamCode: error.upstreamCode });
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Kết nối đang gián đoạn. Vui lòng thử lại hoặc liên hệ Ban Tổ chức.' });
}

module.exports = { config, RegistrationError, validateRegistration, getLarkContext, larkRequest, recordFields, requestBody, sendError };
