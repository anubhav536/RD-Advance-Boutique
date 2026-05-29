const express = require('express');
const healthRoutes = require('./healthRoutes');
const jsonDatabaseRoutes = require('./jsonDatabaseRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/data', jsonDatabaseRoutes);
router.use('/admin/data', jsonDatabaseRoutes);

module.exports = router;
