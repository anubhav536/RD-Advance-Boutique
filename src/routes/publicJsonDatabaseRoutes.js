const express = require('express');
const jsonDatabaseController = require('../controllers/jsonDatabaseController');

const router = express.Router();

router.get('/', jsonDatabaseController.getCollections);
router.get('/:collection', jsonDatabaseController.getCollection);

module.exports = router;
