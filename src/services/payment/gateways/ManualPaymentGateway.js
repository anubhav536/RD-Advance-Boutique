const AppError = require('../../../utils/AppError');
const { PAYMENT_METHODS } = require('../paymentConstants');

class ManualPaymentGateway {
  constructor() {
    this.code = PAYMENT_METHODS.MANUAL_UPI;
    this.type = 'manual';
    this.displayName = 'Manual UPI payment';
  }

  getMetadata() {
    return {
      code: this.code,
      type: this.type,
      displayName: this.displayName,
      requiresAdminVerification: true,
      requiredFields: [
        'upiTransactionId',
        'payment.screenshot.path or payment.screenshot.url',
      ],
      statusFlow: ['not-submitted', 'pending-verification', 'approved', 'rejected'],
    };
  }

  submit({ payment }) {
    if (!payment.upiTransactionId) {
      throw new AppError('UPI transaction ID is required for manual payment verification.', 400);
    }

    if (!payment.screenshot?.dataUrl && !payment.screenshot?.url && !payment.screenshot?.path) {
      throw new AppError('Payment screenshot is required for manual payment verification.', 400);
    }

    return {
      payment: {
        ...payment,
        method: this.code,
        gateway: this.code,
        status: 'pending-verification',
        submittedAt: payment.submittedAt || new Date().toISOString(),
        verifiedAt: null,
        rejectedAt: null,
        verifiedBy: null,
        rejectionReason: null,
      },
    };
  }

  approve({ order, verifiedBy = 'admin' }) {
    if (!order.payment?.upiTransactionId || (!order.payment?.screenshot?.dataUrl && !order.payment?.screenshot?.url && !order.payment?.screenshot?.path)) {
      throw new AppError('Payment cannot be approved until a UPI transaction ID and screenshot are submitted.', 400);
    }

    return {
      orderUpdates: {
        status: 'in-progress',
      },
      payment: {
        ...order.payment,
        method: order.payment.method || this.code,
        gateway: order.payment.gateway || this.code,
        status: 'approved',
        verifiedAt: new Date().toISOString(),
        verifiedBy,
        rejectedAt: null,
        rejectionReason: null,
      },
    };
  }

  reject({ order, reason = '' }) {
    if (!order.payment?.upiTransactionId && !order.payment?.screenshot) {
      throw new AppError('No submitted payment details are available to reject.', 400);
    }

    return {
      orderUpdates: {
        status: 'pending',
      },
      payment: {
        ...order.payment,
        method: order.payment.method || this.code,
        gateway: order.payment.gateway || this.code,
        status: 'rejected',
        verifiedAt: null,
        verifiedBy: null,
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason || 'Payment verification rejected by admin.',
      },
    };
  }
}

module.exports = ManualPaymentGateway;
