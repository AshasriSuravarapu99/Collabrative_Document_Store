const Document = require('../models/Document');
const { generateUniqueSlug, calculateWordCount } = require('../utils/document.utils');

/**
 * Service to handle document-related business logic.
 * 
 * Note: A separate services layer improves scalability by decoupling the core 
 * business logic from the HTTP layer (controllers). This makes the code easier to test, 
 * reuse (e.g., calling services from a cron job or message queue), and maintain.
 */

/**
 * Creates a new document.
 */
const createDocument = async (data) => {
  const { title, content, tags, authorName, authorEmail, authorId } = data;
  
  const slug = await generateUniqueSlug(title, Document);
  const wordCount = calculateWordCount(content);
  const now = new Date();
  
  // Generating author object
  // Next phase note: For authenticated users, this authorId should come from the auth token
  const finalAuthorId = authorId || `user-${Date.now()}`;

  const documentData = {
    slug,
    title,
    content,
    // We explicitly set version to 1 here. This field will be incremented 
    // on every update in Phase 3 to implement Optimistic Concurrency Control (OCC).
    version: 1,
    tags,
    metadata: {
      author: {
        id: finalAuthorId,
        name: authorName,
        email: authorEmail
      },
      createdAt: now,
      updatedAt: now,
      wordCount
    },
    // We initialize revision history immediately. This creates a solid baseline
    // for revision tracking rather than an empty array.
    revision_history: [{
      version: 1,
      updatedAt: now,
      authorId: finalAuthorId,
      contentDiff: "Initial document creation"
    }]
  };

  const newDocument = new Document(documentData);
  await newDocument.save();
  
  return newDocument;
};

/**
 * Retrieves a document by its slug.
 */
const getDocumentBySlug = async (slug) => {
  // We use .lean() here to significantly improve read performance. 
  // It returns plain JavaScript objects rather than heavy Mongoose documents, 
  // saving memory and CPU since we are only reading the data, not saving it.
  const document = await Document.findOne({ slug }).lean();
  
  if (!document) return null;

  // Placeholder for future lazy migration logic
  // e.g., if (typeof document.metadata.author === 'string') { migrateAuthorFormat(document) }

  return document;
};

/**
 * Deletes a document by its slug.
 */
const deleteDocumentBySlug = async (slug) => {
  const deletedDoc = await Document.findOneAndDelete({ slug });
  return deletedDoc;
};

module.exports = {
  createDocument,
  getDocumentBySlug,
  deleteDocumentBySlug
};
