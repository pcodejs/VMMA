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
  data.industryOther = data.industry === 'Khác' && typeof input.industryOther === 'string' ? input.industryOther.trim() : '';
  if (data.industry === 'Khác' && (!data.industryOther || data.industryOther.length > 200)) throw new RegistrationError('Vui lòng nhập lĩnh vực hoạt động của bạn, tối đa 200 ký tự.');
  if (!Array.isArray(input.connections) || !input.connections.length || input.connections.some(value => !config.connections.includes(value))) throw new RegistrationError('Vui lòng chọn doanh nghiệp bạn muốn kết nối.');
  data.connections = [...new Set(input.connections)];
  data.connectionsOther = data.connections.includes('Khác') && typeof input.connectionsOther === 'string' ? input.connectionsOther.trim() : '';
  if (data.connections.includes('Khác') && (!data.connectionsOther || data.connectionsOther.length > 200)) throw new RegistrationError('Vui lòng nhập doanh nghiệp bạn muốn kết nối, tối đa 200 ký tự.');
  if (!['paid', 'guest'].includes(input.attendeeType)) throw new RegistrationError('Vui lòng chọn hình thức tham dự.');
  data.attendeeType = input.attendeeType;
  if (!config.privacyConsents.includes(input.privacyConsent)) throw new RegistrationError('Vui lòng chọn phạm vi đồng ý xử lý thông tin cá nhân trong biểu mẫu đăng ký.');
  data.privacyConsent = input.privacyConsent;
  data.inviteCode = typeof input.inviteCode === 'string' ? input.inviteCode.trim() : '';
  if (data.inviteCode.length > 100) throw new RegistrationError('Mã mời quá dài.');
  data.isBulk = data.quantity === config.quantities[5];
  data.amount = data.attendeeType === 'guest' || data.isBulk ? 0 : (config.quantities.indexOf(data.quantity) + 1) * config.price;
  data.payment = data.attendeeType === 'guest' ? config.paymentLabels.guest : data.isBulk ? config.paymentLabels.bulk : config.paymentLabels.paid;
  if (requirePayment && data.amount > 0 && input.paymentConfirmed !== true) throw new RegistrationError('Vui lòng xác nhận đã chuyển khoản trước khi gửi đăng ký.');
  const transferName = data.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  if (data.amount > 0 && !/^[\x20-\x7e]+$/.test(transferName)) throw new RegistrationError('Vui lòng nhập họ tên bằng chữ Latin để tạo nội dung chuyển khoản.');
  data.memo = `MACF2026 ${transferName} ${data.phone}`.replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (data.amount > 0 && data.memo.length > 50) throw new RegistrationError('Họ tên và số điện thoại vượt giới hạn 50 ký tự của nội dung chuyển khoản. Vui lòng liên hệ Ban Tổ chức.');
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

async function getLarkContext({ refreshFields = false } = {}) {
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
  if (refreshFields || !fieldsCache || fieldsCache.expires < Date.now() || fieldsCache.path !== tablePath) {
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
  const expectedChoices = {
    companySize: config.companySizes, stage: config.stages, industry: config.industries,
    connections: config.connections, quantity: config.quantities,
    payment: Object.values(config.paymentLabels), privacyConsent: config.privacyConsents
  };
  for (const [key, choices] of Object.entries(expectedChoices)) {
    const field = fieldsCache.fields.find(item => item.field_id === config.fieldIds[key]);
    const options = field.property?.options?.map(option => option.name);
    if (!options || options.length !== choices.length || choices.some(choice => !options.includes(choice))) {
      throw new RegistrationError('Biểu mẫu đăng ký đang được cập nhật. Vui lòng quay lại sau hoặc liên hệ Ban Tổ chức qua 0913.989.365.', 503);
    }
  }
  const receiptField = fieldsCache.fields.find(field => field.field_id === config.receiptFieldId && field.type === 17);
  if (!receiptField) throw new RegistrationError('Mục biên lai vừa được cập nhật. Vui lòng liên hệ Ban Tổ chức để hoàn tất đăng ký.', 503);
  return { headers, tablePath, fields: fieldsCache.fields, receiptField };
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
      else throw new RegistrationError('Lựa chọn đăng ký chưa khớp cấu hình Lark. Vui lòng liên hệ Ban Tổ chức.', 503);
    }
    fields[field.field_name] = value;
  }
  return fields;
}

function requestBody(req, maxBytes = 16000) {
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
    if (Buffer.byteLength(body) > maxBytes) throw new RegistrationError('Thông tin đăng ký quá dài.', 413);
    try { body = JSON.parse(body); } catch { throw new RegistrationError('Thông tin đăng ký không hợp lệ.'); }
  }
  if (Buffer.byteLength(JSON.stringify(body || {})) > maxBytes) throw new RegistrationError('Thông tin đăng ký quá dài.', 413);
  return body;
}

function sendError(res, error) {
  console.error('registration_error', { status: error.status || 500, upstreamCode: error.upstreamCode });
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Kết nối đang gián đoạn. Vui lòng thử lại hoặc liên hệ Ban Tổ chức.' });
}

module.exports = { config, RegistrationError, validateRegistration, getLarkContext, larkRequest, recordFields, requestBody, sendError };
