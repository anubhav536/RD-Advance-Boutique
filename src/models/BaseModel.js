class BaseModel {
  constructor(attributes = {}) {
    Object.assign(this, attributes);
  }

  toJSON() {
    return { ...this };
  }
}

module.exports = BaseModel;
