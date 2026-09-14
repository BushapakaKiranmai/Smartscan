const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/apiResponse');

/**
 * Standard API rate limiter (100 requests per 15 minutes by default)
 */
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(res, 'Too many requests from this IP. Please try again later.', null, 429);
  }
});

/**
 * Strict authentication limiter (max 10 login attempts per 15 minutes)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(res, 'Too many authentication attempts. Please try again in 15 minutes.', null, 429);
  }
});

/**
 * Exit code manual entry limiter (max 5 requests per minute per IP / terminal)
 */
const exitCodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(res, 'Too many manual code verification attempts. Terminal temporarily throttled.', null, 429);
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  exitCodeLimiter
};
