const { config, RegistrationError, requestBody, sendError } = require('../lib/registration');
const { lookupDiscountCode } = require('../lib/discount');

module.exports = async function discount(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const body = requestBody(req, 4000);
    const match = lookupDiscountCode(body?.code);
    if (!match) throw new RegistrationError('Mã giảm giá không hợp lệ hoặc đã hết hiệu lực.');
    res.status(200).json({
      valid: true,
      code: match.code,
      partner: match.partner,
      unitPrice: config.discountPrice,
      message: `Tuyệt vời! Mã ưu đãi đã được xác nhận 🎉\n${match.code} — ${match.partner}\nGiá vé ưu đãi: ${new Intl.NumberFormat('vi-VN').format(config.discountPrice)}đ/vé`
    });
  } catch (error) { sendError(res, error); }
};
