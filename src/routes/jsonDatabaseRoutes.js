const express = require('express');
const jsonDatabaseController = require('../controllers/jsonDatabaseController');

const router = express.Router();

router.get('/', jsonDatabaseController.getCollections);
router.get('/:collection', jsonDatabaseController.getCollection);
router.put('/:collection', jsonDatabaseController.replaceCollection);
router.post('/:collection', jsonDatabaseController.createItem);
router.patch('/:collection/:id', jsonDatabaseController.updateItem);
router.delete('/:collection/:id?', jsonDatabaseController.deleteItem);

module.exports = router;
