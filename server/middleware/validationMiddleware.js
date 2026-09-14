const { validationResult } = require('express-validator');
const { errorResponse } = require('../utils/apiResponse');

/**
 * Validates request input against express-validator rules.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(
      res,
      'Validation failed for incoming payload.',
      errors.array().map(err => ({ field: err.path || err.param, message: err.msg })),
      422
    );
  }
  next();
};

/**
 * Zero-Trust Price Stripping Middleware:
 * Actively strips any client-provided price, mrp, sellingPrice, or total fields from request bodies.
 * Prices are strictly server-authoritative.
 */
const stripClientPrices = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const forbiddenFields = [
      'price',
      'sellingPrice',
      'sellingPricePaise',
      'mrp',
      'mrpPaise',
      'subtotal',
      'subtotalPaise',
      'total',
      'totalPaise',
      'finalPayableAmount',
      'finalPayableAmountPaise'
    ];

    forbiddenFields.forEach(field => {
      if (field in req.body) {
        delete req.body[field];
      }
    });

    // Check if items array is in body and strip prices from items
    if (Array.isArray(req.body.items)) {
      req.body.items.forEach(item => {
        if (typeof item === 'object') {
          forbiddenFields.forEach(field => {
            if (field in item) {
              delete item[field];
            }
          });
        }
      });
    }
  }
  next();
};

module.exports = {
  validate,
  stripClientPrices
};
