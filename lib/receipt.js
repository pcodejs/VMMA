const { createHash, createHmac, timingSafeEqual } = require('node:crypto');
const { RegistrationError, larkRequest } = require('./registration');

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BYTES = 2900000;

function validateRequestId(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')) throw new RegistrationError('Mã đăng ký không hợp lệ. Vui lòng mở lại biểu mẫu.');
  return value;
}

function validateImage(input) {
  if (!input || typeof input.base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64) || input.base64.length % 4) throw new RegistrationError('Vui lòng tải ảnh biên lai JPG, PNG hoặc WEBP.');
  const bytes = Buffer.from(input.base64, 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new RegistrationError('Ảnh biên lai cần có dung lượng tối đa 2 MB.', 413);
  let mime;
  let extension;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) { mime = 'image/png'; extension = 'png'; }
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) { mime = 'image/jpeg'; extension = 'jpg'; }
  else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') { mime = 'image/webp'; extension = 'webp'; }
  if (!mime || input.mime !== mime) throw new RegistrationError('Ảnh biên lai chưa đúng định dạng JPG, PNG hoặc WEBP.');
  return { bytes, mime, extension };
}

function fingerprint(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function signature(payload) {
  return createHmac('sha256', process.env.LARK_APP_SECRET).update(`vmaa-receipt-v1:${payload}`).digest();
}

async function uploadReceipt(image, context, requestId, data) {
  const form = new FormData();
  const fileName = `vmaa-${requestId}.${image.extension}`;
  form.set('file_name', fileName);
  form.set('parent_type', 'bitable_image');
  form.set('parent_node', process.env.LARK_BASE_TOKEN);
  form.set('size', String(image.bytes.length));
  form.set('file', new Blob([image.bytes], { type: image.mime }), fileName);
  const result = await larkRequest('drive/v1/medias/upload_all', {
    method: 'POST', headers: { Authorization: context.headers.Authorization }, body: form
  });
  const token = result.data?.file_token;
  if (typeof token !== 'string' || !token) throw new RegistrationError('Chưa xác nhận được kết quả tải biên lai. Vui lòng thử lại.', 502);
  const payload = Buffer.from(JSON.stringify({ requestId, fingerprint: fingerprint(data), token, expires: Date.now() + 86400000 })).toString('base64url');
  return `${payload}.${signature(payload).toString('base64url')}`;
}

function receiptToken(handle, requestId, data) {
  const invalid = () => new RegistrationError('Vui lòng tải lại ảnh biên lai trước khi gửi đăng ký.');
  if (typeof handle !== 'string' || handle.length > 2000) throw invalid();
  const parts = handle.split('.');
  if (parts.length !== 2) throw invalid();
  const actual = Buffer.from(parts[1], 'base64url');
  const expected = signature(parts[0]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); } catch { throw invalid(); }
  if (payload.requestId !== requestId || payload.fingerprint !== fingerprint(data) || payload.expires < Date.now() || typeof payload.token !== 'string' || !payload.token) throw invalid();
  return payload.token;
}

module.exports = { MAX_IMAGE_BYTES, MAX_REQUEST_BYTES, validateRequestId, validateImage, uploadReceipt, receiptToken };
