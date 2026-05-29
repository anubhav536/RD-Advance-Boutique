const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const configureSecurity = (app) => {
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({
    origin: config.clientOrigin === '*' ? true : config.clientOrigin,
    credentials: true,
  }));
  app.use(rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests. Please try again later.',
    },
  }));
};

module.exports = configureSecurity;
