const { RegistrationError, validateRegistration, getLarkContext, larkRequest, recordFields, requestBody, sendError } = require('../lib/registration');
const { validateRequestId, receiptToken } = require('../lib/receipt');

module.exports = async function register(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const body = requestBody(req);
    const data = validateRegistration(body, true);
    validateRequestId(body.requestId);
    if (data.amount > 0 && !body.receiptHandle) throw new RegistrationError('Vui lòng tải ảnh biên lai trước khi gửi đăng ký.');
    const context = await getLarkContext({ refreshFields: true });
    const fields = recordFields(data, context.fields);
    if (data.amount > 0) fields[context.receiptField.field_name] = [{ file_token: receiptToken(body.receiptHandle, body.requestId, data) }];
    const query = new URLSearchParams({ client_token: body.requestId });
    const result = await larkRequest(`${context.tablePath}/records?${query}`, {
      method: 'POST', headers: context.headers,
      body: JSON.stringify({ fields })
    });
    if (!result.data?.record?.record_id) throw new RegistrationError('Chưa xác nhận được kết quả lưu đăng ký. Vui lòng thử lại.', 502);
    res.status(200).json({ success: true });
  } catch (error) { sendError(res, error); }
};
