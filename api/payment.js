const { paymentQR } = require('../lib/payment-qr');
const { config, validateRegistration, getLarkContext, requestBody, sendError } = require('../lib/registration');

module.exports = async function payment(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const data = validateRegistration(requestBody(req));
    await getLarkContext({ refreshFields: true });
    let qrDataURL = null;
    const memo = data.memo;
    if (data.amount > 0) {
      qrDataURL = await paymentQR(data);
    }
    res.status(200).json({ amount: data.amount, unitPrice: data.unitPrice, memo, bank: config.bank, qrDataURL, paymentLabel: data.payment, discount: data.discount });
  } catch (error) { sendError(res, error); }
};
