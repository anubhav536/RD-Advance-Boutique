const path = require('path');
const compression = require('compression');
const express = require('express');
const morgan = require('morgan');
const config = require('./config/env');
const configureSecurity = require('./middleware/securityMiddleware');
const errorMiddleware = require('./middleware/errorMiddleware');
const notFoundMiddleware = require('./middleware/notFoundMiddleware');
const routes = require('./routes');
const { attachAdminSession, requireAdminPage } = require('./middleware/adminAuthMiddleware');

const app = express();

configureSecurity(app);
app.use(attachAdminSession);

if (config.env === 'development') {
  app.use(morgan('dev'));
}

app.use(compression());
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true, limit: '6mb' }));

app.get(config.adminShortcutPath, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.adminSession) {
    return res.redirect(302, '/admin-dashboard.html');
  }

  return res.redirect(302, `/admin-login.html?next=${encodeURIComponent('/admin-dashboard.html')}`);
});

const protectedAdminPages = new Set([
  '/add-category.html',
  '/add-gallery.html',
  '/add-product.html',
  '/admin-categories.html',
  '/admin-contact.html',
  '/admin-course.html',
  '/admin-dashboard.html',
  '/admin-gallery.html',
  '/admin-notifications.html',
  '/admin-products.html',
  '/admin-settings.html',
  '/admin.orders.html',
  '/admissions.html',
  '/all-categories.html',
  '/all-gallery.html',
  '/all-products.html',
  '/completed-orders.html',
  '/contact-messages.html',
  '/course-enquiries.html',
  '/custom-stitching.html',
  '/customer-support.html',
  '/edit-category.html',
  '/edit-gallery.html',
  '/edit-product.html',
  '/pending-orders.html',
  '/product-details.html',
  '/seo-settings.html',
  '/social-links.html',
  '/students.html',
  '/website-settings.html',
]);

app.use((req, res, next) => {
  if (req.method === 'GET' && protectedAdminPages.has(req.path)) {
    return requireAdminPage(req, res, next);
  }

  return next();
});

app.use(config.apiPrefix, routes);

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'RD Advance Boutique API is running.',
    docs: `${config.apiPrefix}/health`,
  });
});

app.use(express.static(path.resolve(__dirname, '..')));

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
