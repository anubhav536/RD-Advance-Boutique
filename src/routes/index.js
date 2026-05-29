const express = require('express');
const healthRoutes = require('./healthRoutes');
const jsonDatabaseRoutes = require('./jsonDatabaseRoutes');
const publicJsonDatabaseRoutes = require('./publicJsonDatabaseRoutes');
const productRoutes = require('./productRoutes');
const galleryRoutes = require('./galleryRoutes');
const orderRoutes = require('./orderRoutes');
const tailoringCourseRoutes = require('./tailoringCourseRoutes');
const contactRoutes = require('./contactRoutes');
const adminAuthRoutes = require('./adminAuthRoutes');
const { requireAdminApi } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/products', productRoutes);
router.use('/gallery', galleryRoutes);
router.use('/orders', orderRoutes);
router.use('/tailoring-courses', tailoringCourseRoutes);
router.use('/contact', contactRoutes);
router.use('/data', publicJsonDatabaseRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/data', requireAdminApi, jsonDatabaseRoutes);

module.exports = router;
