const express = require('express');
const adminAuthController = require('../controllers/adminAuthController');
const { requireAdminApi } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

router.post('/login', adminAuthController.login);
router.post('/logout', requireAdminApi, adminAuthController.logout);
router.get('/session', requireAdminApi, adminAuthController.getSession);

module.exports = router;
