const crypto = require('crypto');

/**
 * Computes SHA-256 hash of a raw string (e.g. exit token or short code).
 */
const sha256 = (input) => {
  return crypto.createHash('sha256').update(String(input).trim()).digest('hex');
};

/**
 * Generates a 256-bit (32-byte) cryptographically secure random token string.
 */
const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generates a 6-character Crockford Base32 alphanumeric fallback code.
 * Excludes ambiguous characters: 0, O, 1, I, L, 8, B.
 */
const generateShortCode = () => {
  const chars = '2345679ACDEFGHJKMNPQRSTVWXYZ';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
};

/**
 * Computes Razorpay HMAC-SHA256 signature.
 */
const computeRazorpaySignature = (orderId, paymentId, secret) => {
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
};

module.exports = {
  sha256,
  generateSecureToken,
  generateShortCode,
  computeRazorpaySignature
};
