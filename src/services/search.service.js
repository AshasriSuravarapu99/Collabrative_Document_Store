const Document = require('../models/Document');
const { generateSafeSnippet } = require('../utils/search.utils');

/**
 * Search Service for handling Full-Text Search.
 */
const performSearch = async (query, tagsArray, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  // Build the query object
  const searchCriteria = {
    $text: { $search: query }
  };

  // If tags are provided, we use $all to strictly match documents containing ALL provided tags.
  // This acts as an AND filter. (If we wanted an OR filter, we would use $in).
  if (tagsArray && tagsArray.length > 0) {
    searchCriteria.tags = { $all: tagsArray };
  }

  // Future Enhancement Placeholder: Fuzzy Search
  // Mongoose/MongoDB standard $text doesn't support advanced fuzzy search directly (unless using Atlas Search).
  // Future phases can implement Atlas Search ($search) or use trigram indexes for typo tolerance.

  // 1. Fetch matching documents
  // Projection + .lean() drastically improves performance by avoiding fetching massive text fields fully
  // and bypassing Mongoose document instantiation overhead.
  const searchPromise = Document.find(searchCriteria)
    .select({
      title: 1,
      slug: 1,
      tags: 1,
      'metadata.author': 1,
      'metadata.updatedAt': 1,
      content: 1, // Need content to generate snippet
      score: { $meta: 'textScore' } // Explicitly request the relevance score
    })
    // Sort by relevance. Without this, results might be ordered by insertion time.
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(limit)
    .lean();

  // 2. Count total documents for pagination
  const countPromise = Document.countDocuments(searchCriteria);

  // Execute both queries concurrently to save time
  const [documents, total] = await Promise.all([searchPromise, countPromise]);

  // Generate safe snippets and remove full content from payload
  const results = documents.map(doc => {
    const preview = generateSafeSnippet(doc.content, 180);
    delete doc.content;
    return {
      ...doc,
      contentPreview: preview
    };
  });

  const totalPages = Math.ceil(total / limit);

  return {
    results,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

module.exports = {
  performSearch
};
