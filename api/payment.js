const { genQRText } = require('vietqr');
const { qrDataURL: renderQR } = require('vietqr/lib/image');
const qrPlatform = require('vietqr/lib/platform');
const { config, validateRegistration, getLarkContext, requestBody, sendError } = require('../lib/registration');

module.exports = async function payment(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const data = validateRegistration(requestBody(req));
    await getLarkContext();
    let qrDataURL = null;
    let memo = data.memo;
    if (data.amount > 0) {
      // Keep the required hyphen separators in both the preview and encoded memo.
      const payload = genQRText({ acqId: config.bank.bin, accountNo: config.bank.account, amount: data.amount, addInfo: memo });
      qrDataURL = renderQR(payload, 'png', qrPlatform);
    }
    res.status(200).json({ amount: data.amount, memo, bank: config.bank, qrDataURL, paymentLabel: data.payment });
  } catch (error) { sendError(res, error); }
};
