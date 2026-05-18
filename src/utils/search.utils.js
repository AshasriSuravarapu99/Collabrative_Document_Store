/**
 * Normalizes a search query string.
 * Trims whitespace and collapses multiple spaces.
 * @param {string} query 
 * @returns {string} Normalized query
 */
const normalizeSearchQuery = (query) => {
  if (!query) return '';
  return query.trim().replace(/\s+/g, ' ');
};

/**
 * Safely generates a snippet from content.
 * Attempts to not cut words mid-sentence by cutting at the nearest space.
 * @param {string} content 
 * @param {number} length 
 * @returns {string} Snippet
 */
const generateSafeSnippet = (content, length = 150) => {
  if (!content) return '';
  if (content.length <= length) return content;
  
  const substring = content.substring(0, length);
  const lastSpaceIndex = substring.lastIndexOf(' ');
  
  if (lastSpaceIndex > 0) {
    return substring.substring(0, lastSpaceIndex) + '...';
  }
  
  return substring + '...';
};

module.exports = {
  normalizeSearchQuery,
  generateSafeSnippet
};
