const express = require('express');
const healthRoutes = require('./healthRoutes');
const jsonDatabaseRoutes = require('./jsonDatabaseRoutes');
const productRoutes = require('./productRoutes');
const galleryRoutes = require('./galleryRoutes');
const orderRoutes = require('./orderRoutes');
const tailoringCourseRoutes = require('./tailoringCourseRoutes');
const contactRoutes = require('./contactRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/products', productRoutes);
router.use('/gallery', galleryRoutes);
router.use('/orders', orderRoutes);
router.use('/tailoring-courses', tailoringCourseRoutes);
router.use('/contact', contactRoutes);
router.use('/data', jsonDatabaseRoutes);
router.use('/admin/data', jsonDatabaseRoutes);

module.exports = router;
