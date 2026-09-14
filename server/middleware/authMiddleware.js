const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/apiResponse');

/**
 * Authentication Middleware:
 * Verifies JWT token from Authorization header and attaches payload to req.user.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Authentication required. No token provided.', null, 401);
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error('[FATAL] JWT_SECRET is not configured.');
    return errorResponse(res, 'Server authentication configuration error.', null, 500);
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = {
      id: decoded.id,
      _id: decoded.id,
      role: decoded.role
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Authentication token has expired. Please login again.', null, 401);
    }
    return errorResponse(res, 'Invalid authentication token.', null, 401);
  }
};

module.exports = {
  authenticate
};
