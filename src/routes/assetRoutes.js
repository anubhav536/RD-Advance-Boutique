const express = require('express');
const assetController = require('../controllers/assetController');
const localUpload = require('../middleware/localUploadMiddleware');
const { requireAdminApi } = require('../middleware/adminAuthMiddleware');

const router = express.Router();
const parseAssetUpload = localUpload({ fieldName: 'asset' });

router.get('/', assetController.getAssets);
router.get('/:type', assetController.getAssetsByType);
router.post('/:type', requireAdminApi, parseAssetUpload, assetController.uploadAsset);
router.put('/:type/:id', requireAdminApi, parseAssetUpload, assetController.replaceAsset);
router.patch('/:type/:id', requireAdminApi, parseAssetUpload, assetController.replaceAsset);
router.delete('/:type/:id', requireAdminApi, assetController.deleteAsset);

module.exports = router;
