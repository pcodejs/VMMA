const { RegistrationError, validateRegistration, getLarkContext, larkRequest, recordFields, requestBody, sendError } = require('../lib/registration');

module.exports = async function register(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const body = requestBody(req);
    const data = validateRegistration(body, true);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId || '')) throw new RegistrationError('Mã đăng ký không hợp lệ. Vui lòng mở lại biểu mẫu.');
    const context = await getLarkContext();
    const query = new URLSearchParams({ client_token: body.requestId });
    const result = await larkRequest(`${context.tablePath}/records?${query}`, {
      method: 'POST', headers: context.headers,
      body: JSON.stringify({ fields: recordFields(data, context.fields) })
    });
    if (!result.data?.record?.record_id) throw new RegistrationError('Chưa xác nhận được kết quả lưu đăng ký. Vui lòng thử lại.', 502);
    res.status(200).json({ success: true });
  } catch (error) { sendError(res, error); }
};
