const ManualPaymentGateway = require('./ManualPaymentGateway');

const gateways = [
  new ManualPaymentGateway(),
];

module.exports = gateways;
