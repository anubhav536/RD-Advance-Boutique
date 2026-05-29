const compression = require('compression');
const express = require('express');
const morgan = require('morgan');
const config = require('./config/env');
const configureSecurity = require('./middleware/securityMiddleware');
const errorMiddleware = require('./middleware/errorMiddleware');
const notFoundMiddleware = require('./middleware/notFoundMiddleware');
const routes = require('./routes');

const app = express();

configureSecurity(app);

if (config.env === 'development') {
  app.use(morgan('dev'));
}

app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(config.apiPrefix, routes);

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'RD Advance Boutique API is running.',
    docs: `${config.apiPrefix}/health`,
  });
});

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
