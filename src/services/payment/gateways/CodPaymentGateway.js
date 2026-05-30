const AppError = require('../../../utils/AppError');
const { PAYMENT_METHODS } = require('../paymentConstants');

class CodPaymentGateway {
  constructor() {
    this.code = PAYMENT_METHODS.COD;
    this.type = 'offline';
    this.displayName = 'Cash on delivery / pay at boutique';
  }

  getMetadata() {
    return {
      code: this.code,
      type: this.type,
      displayName: this.displayName,
      requiresAdminVerification: true,
      requiredFields: ['customer.name', 'customer.phone'],
      statusFlow: ['not-submitted', 'approved', 'rejected'],
    };
  }

  submit({ payment }) {
    return {
      payment: {
        ...payment,
        method: this.code,
        gateway: this.code,
        status: payment.status === 'rejected' ? 'rejected' : 'not-submitted',
        submittedAt: payment.submittedAt || new Date().toISOString(),
      },
    };
  }

  approve({ order, verifiedBy = 'admin' }) {
    if ((order.payment?.method || this.code) !== this.code) {
      throw new AppError('This order is not configured for cash on delivery.', 400);
    }

    return {
      orderUpdates: { status: 'in-progress' },
      payment: {
        ...order.payment,
        method: this.code,
        gateway: this.code,
        status: 'approved',
        verifiedAt: new Date().toISOString(),
        verifiedBy,
        rejectedAt: null,
        rejectionReason: null,
      },
    };
  }

  reject({ order, reason = '' }) {
    return {
      orderUpdates: { status: 'pending' },
      payment: {
        ...order.payment,
        method: this.code,
        gateway: this.code,
        status: 'rejected',
        verifiedAt: null,
        verifiedBy: null,
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason || 'COD approval rejected by admin.',
      },
    };
  }
}

module.exports = CodPaymentGateway;
