const AppError = require('../../utils/AppError');
const OrderModel = require('../../models/OrderModel');
const gateways = require('./gateways');
const { DEFAULT_PAYMENT_METHOD } = require('./paymentConstants');

class PaymentService {
  static listMethods() {
    return gateways.map((gateway) => gateway.getMetadata());
  }

  static getGateway(method = DEFAULT_PAYMENT_METHOD) {
    const gateway = gateways.find((entry) => entry.code === method);

    if (!gateway) {
      throw new AppError(`Payment method "${method}" is not supported.`, 400, {
        supportedMethods: gateways.map((entry) => entry.code),
      });
    }

    return gateway;
  }

  static resolveMethod(payload = {}, currentPayment = {}) {
    return payload.payment?.method
      || payload.paymentMethod
      || currentPayment.method
      || currentPayment.gateway
      || DEFAULT_PAYMENT_METHOD;
  }

  static async submitOrderPayment(orderId, payload = {}) {
    const order = await OrderModel.findById(orderId);
    const method = PaymentService.resolveMethod(payload, order.payment || {});
    const gateway = PaymentService.getGateway(method);
    const payment = OrderModel.normalizePaymentPayload(payload, order.payment || {});
    const result = gateway.submit({ order, payment, payload });

    return OrderModel.savePayment(orderId, result.payment, result.orderUpdates);
  }

  static async approveOrderPayment(orderId, { verifiedBy = 'admin' } = {}) {
    const order = await OrderModel.findById(orderId);
    const gateway = PaymentService.getGateway(PaymentService.resolveMethod({}, order.payment || {}));
    const result = gateway.approve({ order, verifiedBy });

    return OrderModel.savePayment(orderId, result.payment, result.orderUpdates);
  }

  static async rejectOrderPayment(orderId, { reason = '' } = {}) {
    const order = await OrderModel.findById(orderId);
    const gateway = PaymentService.getGateway(PaymentService.resolveMethod({}, order.payment || {}));
    const result = gateway.reject({ order, reason });

    return OrderModel.savePayment(orderId, result.payment, result.orderUpdates);
  }
}

module.exports = PaymentService;
