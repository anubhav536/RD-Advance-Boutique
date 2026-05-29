const express = require('express');
const healthRoutes = require('./healthRoutes');
const jsonDatabaseRoutes = require('./jsonDatabaseRoutes');
const productRoutes = require('./productRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/products', productRoutes);
router.use('/data', jsonDatabaseRoutes);
router.use('/admin/data', jsonDatabaseRoutes);

module.exports = router;
