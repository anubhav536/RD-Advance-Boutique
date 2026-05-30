const PAYMENT_STATUSES = Object.freeze([
  'not-submitted',
  'pending-verification',
  'approved',
  'rejected',
]);

const PAYMENT_METHODS = Object.freeze({
  MANUAL_UPI: 'manual-upi',
  COD: 'cod',
});

const DEFAULT_PAYMENT_METHOD = PAYMENT_METHODS.COD;
const DEFAULT_PAYMENT_STATUS = 'not-submitted';

module.exports = {
  DEFAULT_PAYMENT_METHOD,
  DEFAULT_PAYMENT_STATUS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
};
