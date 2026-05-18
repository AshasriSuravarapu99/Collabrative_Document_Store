const analyticsService = require('../services/analytics.service');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

/**
 * Validates and normalizes pagination parameters
 */
const parsePagination = (page, limit) => {
  let pageNum = parseInt(page, 10) || 1;
  let limitNum = parseInt(limit, 10) || 10;

  if (pageNum < 1) pageNum = 1;
  if (limitNum < 1) limitNum = 10;
  if (limitNum > 50) limitNum = 50; // hard limit to protect db

  return { pageNum, limitNum };
};

/**
 * GET /api/analytics/most-edited
 * Returns documents sorted by highest revision count.
 */
const getMostEdited = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { pageNum, limitNum } = parsePagination(page, limit);

  const startTime = Date.now();
  const results = await analyticsService.getMostEditedDocuments(pageNum, limitNum);
  const duration = Date.now() - startTime;

  logger.info(`Analytics [Most Edited] executed in ${duration}ms | limit: ${limitNum}`);

  res.status(200).json({
    success: true,
    count: results.length,
    results
  });
});

/**
 * GET /api/analytics/tag-cooccurrence
 * Returns the most frequently paired tags.
 */
const getTagCooccurrence = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { pageNum, limitNum } = parsePagination(page, limit);

  const startTime = Date.now();
  const results = await analyticsService.getTagCooccurrence(pageNum, limitNum);
  const duration = Date.now() - startTime;

  logger.info(`Analytics [Tag Co-occurrence] executed in ${duration}ms | limit: ${limitNum}`);

  res.status(200).json({
    success: true,
    count: results.length,
    results
  });
});

module.exports = {
  getMostEdited,
  getTagCooccurrence
};
