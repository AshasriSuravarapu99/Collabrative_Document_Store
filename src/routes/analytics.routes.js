const express = require('express');
const analyticsController = require('../controllers/analytics.controller');

const router = express.Router();

router.get('/most-edited', analyticsController.getMostEdited);
router.get('/tag-cooccurrence', analyticsController.getTagCooccurrence);

module.exports = router;
