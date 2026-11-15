const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const codesPath = path.join(__dirname, '..', 'data', 'discount-codes.json');

function normalizeDiscountCode(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function hashDiscountCode(code) {
  return crypto.createHash('sha256').update(code, 'utf8').digest('hex');
}

function lookupDiscountCode(value) {
  const code = normalizeDiscountCode(value);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return null;
  const digest = hashDiscountCode(code);
  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(codesPath, 'utf8'));
  } catch {
    throw new Error('Discount code data is unavailable.');
  }
  const matching = entries.find(entry => typeof entry?.hash === 'string' && entry.hash.length === digest.length && crypto.timingSafeEqual(Buffer.from(entry.hash), Buffer.from(digest)));
  return matching ? { code, partner: matching.partner } : null;
}

module.exports = { normalizeDiscountCode, hashDiscountCode, lookupDiscountCode };
