const BaseModel = require('./BaseModel');

class HealthModel extends BaseModel {
  static currentStatus() {
    return new HealthModel({
      status: 'ok',
      service: 'RD Advance Boutique API',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }
}

module.exports = HealthModel;
