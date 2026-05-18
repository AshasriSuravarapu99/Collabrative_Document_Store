/**
 * Async handler to wrap async route functions and pass errors to Express's error handling middleware.
 * Reduces the need for repeated try-catch blocks in controllers.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
