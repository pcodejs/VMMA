const { RegistrationError, requestBody, sendError } = require('../lib/registration');

module.exports = async function taxCode(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const body = requestBody(req, 256);
    const taxCode = typeof body?.taxCode === 'string' ? body.taxCode.replace(/[\s-]/g, '') : '';
    if (!/^(?:\d{10}|\d{13})$/.test(taxCode)) {
      throw new RegistrationError('Vui lòng nhập mã số thuế doanh nghiệp gồm 10 số hoặc 13 số.');
    }
    let response;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(`https://api.vietqr.io/v2/business/${taxCode}`, {
          signal: AbortSignal.timeout(8000)
        });
        if (response.status < 500 || response.ok) break;
      } catch (error) {
        if (attempt === 1) throw error;
      }
    }
    if (!response.ok) {
      const error = new RegistrationError('Tra cứu đang gián đoạn. Bạn có thể nhập thông tin hóa đơn bên dưới.', 503);
      error.upstreamCode = response.status;
      throw error;
    }
    const result = await response.json();
    if (['51', '52'].includes(result.code)) {
      throw new RegistrationError('Chưa tìm thấy doanh nghiệp. Vui lòng kiểm tra mã số thuế hoặc nhập thông tin hóa đơn bên dưới.', 404);
    }
    const data = result.data;
    const returnedTaxCode = typeof data?.id === 'string' ? data.id.replace(/[\s-]/g, '') : '';
    if (result.code !== '00' || returnedTaxCode !== taxCode ||
        typeof data.name !== 'string' || !data.name.trim() || data.name.length > 400 ||
        typeof data.address !== 'string' || !data.address.trim() || data.address.length > 1000) {
      throw new RegistrationError('Chưa lấy được đầy đủ thông tin doanh nghiệp. Bạn có thể nhập thông tin hóa đơn bên dưới.', 502);
    }
    res.status(200).json({ taxCode, name: data.name.trim(), address: data.address.trim() });
  } catch (error) {
    if (!error.status) {
      const upstreamCode = error.cause?.code || error.name;
      error = new RegistrationError('Tra cứu đang gián đoạn. Bạn có thể nhập thông tin hóa đơn bên dưới.', 503);
      error.upstreamCode = upstreamCode;
    }
    sendError(res, error);
  }
};
