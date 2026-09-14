const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const authController = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimitMiddleware');
const { authenticate } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new customer account
 */
router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Full name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please provide a valid email address')
  ],
  validate,
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate customer or administrator
 */
router.post(
  '/login',
  authLimiter,
  [
    body('password').notEmpty().withMessage('Password is required')
  ],
  validate,
  authController.login
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user profile
 */
router.get('/me', authenticate, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update current authenticated user profile and role
 */
router.put(
  '/profile',
  authenticate,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().trim().notEmpty().withMessage('Phone cannot be empty'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please provide a valid email address'),
    body('role').optional().trim().notEmpty().withMessage('Role cannot be empty')
  ],
  validate,
  authController.updateProfile
);

module.exports = router;
