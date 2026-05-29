const config = require('../config/env');

const sendError = (err, res) => {
  const statusCode = err.statusCode || 500;
  const payload = {
    success: false,
    status: err.status || 'error',
    message: err.isOperational ? err.message : 'Something went wrong.',
  };

  if (err.details) {
    payload.details = err.details;
  }

  if (config.env === 'development') {
    payload.error = err.message;
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
};

const errorMiddleware = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  return sendError(err, res);
};

module.exports = errorMiddleware;
