const documentService = require('../services/document.service');
const asyncHandler = require('../utils/asyncHandler');
const { sanitizeTags } = require('../utils/document.utils');

/**
 * Helper to validate an email address format
 */
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Create a new document (POST /api/documents)
 */
const createDocument = asyncHandler(async (req, res) => {
  let { title, content, tags, authorName, authorEmail } = req.body;

  // 1. Validation & Sanitization
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ success: false, message: 'Title is required and must not be empty.' });
  }
  
  if (title.trim().length > 150) {
    return res.status(400).json({ success: false, message: 'Title must not exceed 150 characters.' });
  }

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ success: false, message: 'Content is required and must not be empty.' });
  }

  if (tags && !Array.isArray(tags)) {
    return res.status(400).json({ success: false, message: 'Tags must be an array of strings.' });
  }

  if (!authorName || typeof authorName !== 'string' || authorName.trim() === '') {
    return res.status(400).json({ success: false, message: 'Author name is required.' });
  }

  if (!authorEmail || !isValidEmail(authorEmail)) {
    return res.status(400).json({ success: false, message: 'A valid author email is required.' });
  }

  // Sanitize inputs
  title = title.trim();
  content = content.trim();
  authorName = authorName.trim();
  authorEmail = authorEmail.trim().toLowerCase();
  const sanitizedTags = sanitizeTags(tags);

  // 2. Call service layer
  const document = await documentService.createDocument({
    title,
    content,
    tags: sanitizedTags,
    authorName,
    authorEmail
  });

  // 3. Respond with Location header and 201 status
  res.status(201)
    .location(`/api/documents/${document.slug}`)
    .json({
      success: true,
      message: 'Document created successfully',
      data: document
    });
});

/**
 * Get a document by slug (GET /api/documents/:slug)
 */
const getDocumentBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const document = await documentService.getDocumentBySlug(slug);

  if (!document) {
    return res.status(404).json({ success: false, message: 'Document not found' });
  }

  res.status(200).json({
    success: true,
    data: document
  });
});

/**
 * Delete a document by slug (DELETE /api/documents/:slug)
 */
const deleteDocumentBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const deletedDocument = await documentService.deleteDocumentBySlug(slug);

  if (!deletedDocument) {
    return res.status(404).json({ success: false, message: 'Document not found' });
  }

  res.status(200).json({
    success: true,
    message: 'Document deleted successfully',
    deletedSlug: deletedDocument.slug,
    deletedId: deletedDocument._id
  });
});

module.exports = {
  createDocument,
  getDocumentBySlug,
  deleteDocumentBySlug
};
