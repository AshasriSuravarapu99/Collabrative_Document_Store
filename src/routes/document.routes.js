const express = require('express');
const documentController = require('../controllers/document.controller');

const router = express.Router();

router.post('/', documentController.createDocument);
router.get('/:slug', documentController.getDocumentBySlug);
router.put('/:slug', documentController.updateDocument);
router.delete('/:slug', documentController.deleteDocumentBySlug);

module.exports = router;
