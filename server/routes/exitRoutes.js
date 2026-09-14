const express = require('express');
const router = express.Router();
const exitController = require('../controllers/exitController');
const jwt = require('jsonwebtoken');

// Soft authentication middleware so gate terminal staff can be identified if token is present
const softAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.id, _id: decoded.id, role: decoded.role };
    } catch (err) {
      // Ignore token parse error for open gate scanning
    }
  }
  next();
};

/**
 * LAYER 1: Digital Exit Pass / QR Verification
 * POST /api/v1/exit/verify-pass
 */
router.post('/verify-pass', softAuth, exitController.verifyExitPass);

/**
 * LAYER 2: Physical Basket Verification
 * POST /api/v1/exit/verify-basket
 */
router.post('/verify-basket', softAuth, exitController.verifyBasket);

/**
 * Unified / Backward-compatible exit verification
 * POST /api/v1/exit/verify
 */
router.post('/verify', softAuth, exitController.legacyVerify);

/**
 * Single Exit Pass Details
 * GET /api/v1/exit/pass/:id
 * GET /api/v1/exit/token/:id
 * GET /api/v1/exit-passes/:id
 */
router.get('/pass/:id', softAuth, exitController.getExitPass);
router.get('/token/:id', softAuth, exitController.getExitPass);
router.get('/:id', softAuth, exitController.getExitPass);

module.exports = router;

