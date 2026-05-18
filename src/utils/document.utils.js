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

module.exports = {
  generateUniqueSlug,
  calculateWordCount,
  sanitizeTags,
  generateContentDiff
};
