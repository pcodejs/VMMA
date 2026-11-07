const path = require('node:path');
const sharp = require('sharp');
const { config, RegistrationError } = require('./registration');

async function paymentQR(data) {
  const url = new URL(`https://img.vietqr.io/image/${config.bank.bin}-${config.bank.account}-qr_only.svg`);
  url.search = new URLSearchParams({ amount: String(data.amount), addInfo: data.memo }).toString();
  const response = await fetch(url.toString(), {
    headers: { Accept: 'image/svg+xml' }, signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new RegistrationError('Chưa tạo được mã QR chuyển khoản. Vui lòng thử lại.', 502);
  const svg = await response.text();
  if (!svg.includes('<svg') || Buffer.byteLength(svg) > 300000) throw new RegistrationError('Mã QR trả về chưa hợp lệ. Vui lòng thử lại.', 502);

  const logo = await sharp(path.join(__dirname, '../assets/partners/vmaa.webp'))
    .resize(80, 80, { fit: 'contain', background: '#ffffff' })
    .extend({ top: 4, bottom: 4, left: 4, right: 4, background: '#ffffff' })
    .png().toBuffer();
  const png = await sharp(Buffer.from(svg), { limitInputPixels: 1000000 })
    .resize(490, 490)
    .composite([{ input: logo, gravity: 'centre' }])
    .extend({ top: 24, bottom: 24, left: 24, right: 24, background: '#ffffff' })
    .png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

module.exports = { paymentQR };
