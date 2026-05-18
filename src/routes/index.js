const express = require('express');
const healthRoutes = require('./health.routes');
const documentRoutes = require('./document.routes');
const searchRoutes = require('./search.routes');
const analyticsRoutes = require('./analytics.routes');
const router = express.Router();

// Register all routes
router.use('/health', healthRoutes);
router.use('/api/documents', documentRoutes);
router.use('/api/search', searchRoutes);
router.use('/api/analytics', analyticsRoutes);

module.exports = router;
