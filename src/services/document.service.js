const Document = require('../models/Document');
const logger = require('../utils/logger');
const { generateUniqueSlug, calculateWordCount, generateContentDiff } = require('../utils/document.utils');

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

/**
 * Updates a document using Optimistic Concurrency Control (OCC).
 * 
 * OCC Explanation:
 * - We enforce that the client provides the 'version' they are trying to update.
 * - The atomic query { slug, version } ensures that if another user updated the document
 *   in the meantime (incrementing the version), this query will not match and fail cleanly.
 * - This prevents the "lost update" problem where stale data overwrites new data.
 * - MongoDB single-document updates (like findOneAndUpdate) are atomic by default,
 *   meaning no two operations can interleave on the same document. This is why OCC works 
 *   safely here without requiring multi-document transactions.
 */
const updateDocument = async (slug, clientVersion, data) => {
  const { title, content, tags, authorId } = data;
  
  // 1. Fetch existing document first to generate better revision metadata
  const existingDoc = await Document.findOne({ slug }).lean();
  if (!existingDoc) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  // 2. Generate diff and metadata
  const newWordCount = calculateWordCount(content);
  const contentDiff = generateContentDiff(existingDoc.content, content);
  const now = new Date();

  const revisionEntry = {
    version: clientVersion + 1,
    updatedAt: now,
    authorId: authorId,
    previousTitle: existingDoc.title,
    previousWordCount: existingDoc.metadata.wordCount,
    contentDiff
  };

  // 3. Run atomic OCC update
  const updatedDoc = await Document.findOneAndUpdate(
    { slug, version: clientVersion },
    {
      $set: {
        title,
        content,
        tags,
        'metadata.updatedAt': now,
        'metadata.wordCount': newWordCount
      },
      $inc: { version: 1 },
      $push: {
        revision_history: {
          $each: [revisionEntry],
          $slice: -20 // Keeps only the latest 20 revisions
        }
      }
    },
    { new: true } // Returns the modified document
  ).lean();

  // 4. Conflict Handling
  if (!updatedDoc) {
    // If we reach here, it means the document exists (checked in step 1), 
    // but the 'version' did not match. This is an OCC conflict.
    logger.warn(`OCC conflict detected for slug: ${slug} (Expected version: ${clientVersion}, Actual: ${existingDoc.version})`);
    
    // We already have the latest doc from step 1 if the conflict just happened, 
    // but to be absolutely sure we have the *current* state (if someone just wrote to it),
    // we fetch it again.
    const latestDocument = await Document.findOne({ slug }).lean();
    
    const error = new Error('Version conflict detected');
    error.statusCode = 409;
    error.latestDocument = latestDocument;
    throw error;
  }

  return updatedDoc;
};

module.exports = {
  createDocument,
  getDocumentBySlug,
  deleteDocumentBySlug,
  updateDocument
};
