const express = require('express');
const healthRoutes = require('./health.routes');
const documentRoutes = require('./document.routes');
const searchRoutes = require('./search.routes');
const router = express.Router();

// Register all routes
router.use('/health', healthRoutes);
router.use('/api/documents', documentRoutes);
router.use('/api/search', searchRoutes);

module.exports = router;
