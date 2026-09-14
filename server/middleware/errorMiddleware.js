const { errorResponse } = require('../utils/apiResponse');

/**
 * 404 Route Not Found Middleware
 */
const notFound = (req, res, next) => {
  return errorResponse(res, `Route not found: ${req.originalUrl}`, null, 404);
};

/**
 * Centralized Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${err.name || 'Server Error'}: ${err.message}`);
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    console.error(err.stack);
  }

  // MongoDB Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    return errorResponse(
      res,
      `Duplicate value entered for ${field}: "${value}". It must be unique.`,
      null,
      409
    );
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    return errorResponse(res, 'Database validation error occurred.', errors, 422);
  }

  // Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return errorResponse(res, `Invalid resource identifier format for: ${err.path}`, null, 400);
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid authentication token.', null, 401);
  }

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  return errorResponse(
    res,
    err.message || 'Internal Server Error. Please contact support.',
    process.env.NODE_ENV === 'development' ? { stack: err.stack } : null,
    statusCode
  );
};

module.exports = {
  notFound,
  errorHandler
};
