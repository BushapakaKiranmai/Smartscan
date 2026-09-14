/**
 * Payment status states matching docs/DATABASE_DESIGN.md
 */
const PAYMENT_STATUS = {
  CREATED: 'CREATED',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED'
};

module.exports = {
  PAYMENT_STATUS,
  ALL_PAYMENT_STATUSES: Object.values(PAYMENT_STATUS)
};
