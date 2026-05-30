const ManualPaymentGateway = require('./ManualPaymentGateway');
const CodPaymentGateway = require('./CodPaymentGateway');

module.exports = [
  new ManualPaymentGateway(),
  new CodPaymentGateway(),
];
