const Razorpay = require('razorpay');
const dotenv = require('dotenv');
const path = require('path');

/**
 * Initializes and exports the Razorpay instance.
 * Dynamically reloads .env so changes saved to server/.env are picked up immediately
 * without requiring a node server restart.
 */
const getRazorpayInstance = () => {
  try {
    dotenv.config({ path: path.join(__dirname, '../.env'), override: true });
  } catch (e) {
    // Ignore dotenv error if path issue
  }

  const key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
  const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  if (!key_id || !key_secret || key_id.includes('placeholder') || key_secret.includes('your_razorpay')) {
    return null;
  }

  try {
    return new Razorpay({
      key_id,
      key_secret
    });
  } catch (err) {
    console.error('[Razorpay Init Error]', err.message);
    return null;
  }
};

module.exports = {
  getRazorpayInstance
};
