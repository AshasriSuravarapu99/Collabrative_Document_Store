const searchService = require('../services/search.service');
const asyncHandler = require('../utils/asyncHandler');
const { sanitizeTags } = require('../utils/document.utils');
const { normalizeSearchQuery } = require('../utils/search.utils');
const logger = require('../utils/logger');

/**
 * Perform Full-Text Search (GET /api/search)
 */
const searchDocuments = asyncHandler(async (req, res) => {
  const { q, tags, page, limit } = req.query;

  // 1. Validate Query
  if (!q || typeof q !== 'string' || q.trim() === '') {
    return res.status(400).json({ success: false, message: 'Search query (q parameter) is required.' });
  }

  // Prevent extremely large queries (e.g. DDOS/memory abuse)
  if (q.length > 200) {
    return res.status(400).json({ success: false, message: 'Search query exceeds maximum allowed length of 200 characters.' });
  }

  // 2. Normalize and Sanitize
  const normalizedQuery = normalizeSearchQuery(q);
  
  let tagsArray = [];
  if (tags && typeof tags === 'string') {
    const rawTags = tags.split(',');
    tagsArray = sanitizeTags(rawTags);
  }

  // 3. Pagination Parsing
  // Pagination is critical for scalability to ensure we don't accidentally load 10,000 documents into RAM
  let pageNum = parseInt(page, 10) || 1;
  let limitNum = parseInt(limit, 10) || 10;

  if (pageNum < 1) pageNum = 1;
  if (limitNum < 1) limitNum = 10;
  if (limitNum > 50) limitNum = 50; // Max limit cap

  logger.info(`Search executed: "${normalizedQuery}" | tags: [${tagsArray.join(',')}] | page: ${pageNum} | limit: ${limitNum}`);

  // 4. Execute Search
  const { results, pagination } = await searchService.performSearch(normalizedQuery, tagsArray, pageNum, limitNum);

  // 5. Fallback Response (Requested behavior for empty results instead of errors)
  if (results.length === 0) {
    logger.info(`Search yielded 0 results for: "${normalizedQuery}"`);
    return res.status(200).json({
      success: true,
      count: 0,
      results: [],
      pagination
    });
  }

  logger.info(`Search yielded ${pagination.total} total results for: "${normalizedQuery}"`);

  // 6. Success Response
  res.status(200).json({
    success: true,
    count: results.length,
    results,
    pagination
  });
});

module.exports = {
  searchDocuments
};
