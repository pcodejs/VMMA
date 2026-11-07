const { RegistrationError, validateRegistration, getLarkContext, requestBody, sendError } = require('../lib/registration');
const { MAX_REQUEST_BYTES, validateRequestId, validateImage, uploadReceipt } = require('../lib/receipt');

module.exports = async function receipt(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const body = requestBody(req, MAX_REQUEST_BYTES);
    const data = validateRegistration(body, true);
    const requestId = validateRequestId(body.requestId);
    if (!data.amount) throw new RegistrationError('Hình thức tham dự này không cần tải biên lai.');
    const image = validateImage(body.receipt);
    const context = await getLarkContext();
    const receiptHandle = await uploadReceipt(image, context, requestId, data);
    res.status(200).json({ receiptHandle });
  } catch (error) { sendError(res, error); }
};
