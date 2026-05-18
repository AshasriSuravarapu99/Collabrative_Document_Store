const slugify = require('slugify');

/**
 * Generates a unique slug for a document.
 * @param {string} title - The title of the document.
 * @param {Model} DocumentModel - The Mongoose model to check for existence against.
 * @returns {Promise<string>} A unique slug.
 */
const generateUniqueSlug = async (title, DocumentModel) => {
  // Slug uniqueness matters because slugs act as the primary, SEO-friendly identifier
  // for documents in URLs (e.g. /docs/my-awesome-doc). If two documents share a slug, 
  // users would not be able to reliably retrieve their specific document.
  let baseSlug = slugify(title, { lower: true, strict: true, trim: true });
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existingDoc = await DocumentModel.findOne({ slug }).lean();
    if (!existingDoc) {
      break;
    }
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

/**
 * Calculates the word count of a given string.
 * @param {string} content - The text to process.
 * @returns {number} The word count.
 */
const calculateWordCount = (content) => {
  if (!content) return 0;
  return content.trim().split(/\s+/).length;
};

/**
 * Sanitizes and normalizes tags.
 * @param {Array<string>} tags - The raw tags array.
 * @returns {Array<string>} The sanitized tags array.
 */
const sanitizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  // Lowercase, trim, and remove duplicates/empty tags
  return [...new Set(tags.map(t => t.trim().toLowerCase()).filter(t => t.length > 0))];
};

/**
 * Generates a simple diff summary between old and new content.
 * @param {string} oldContent - The original text.
 * @param {string} newContent - The updated text.
 * @returns {string} A summary of the changes.
 */
const generateContentDiff = (oldContent, newContent) => {
  const oldLen = (oldContent || '').length;
  const newLen = (newContent || '').length;
  const diff = newLen - oldLen;
  const sign = diff >= 0 ? '+' : '';
  return `Content length changed from ${oldLen} to ${newLen} characters. (${sign}${diff})`;
};

/**
 * Safely normalizes the author schema.
 * Supports Lazy On-Read Migrations by transforming old string authors into objects on the fly.
 * @param {any} author - The raw author field from the DB.
 * @returns {object} The normalized author object.
 */
const normalizeAuthorSchema = (author) => {
  // Defensive validation against empty or malformed inputs
  if (!author) {
    return { id: null, name: 'Unknown', email: null };
  }

  // If it's already an object (new schema), return it safely
  if (typeof author === 'object' && !Array.isArray(author)) {
    return author;
  }

  // If it's the old schema (string), transform it dynamically
  if (typeof author === 'string') {
    return {
      id: null,
      name: author.trim() || 'Unknown',
      email: null
    };
  }

  // Fallback for completely unexpected types
  return { id: null, name: 'Unknown', email: null };
};

module.exports = {
  generateUniqueSlug,
  calculateWordCount,
  sanitizeTags,
  generateContentDiff,
  normalizeAuthorSchema
};
