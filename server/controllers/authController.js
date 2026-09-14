const authService = require('../services/authService');
const { successResponse } = require('../utils/apiResponse');

/**
 * Register customer account
 * POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    return successResponse(res, 'Registration successful', result, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    return successResponse(res, 'Login successful', result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get profile
 * GET /api/auth/me
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.user.id);
    return successResponse(res, 'Current user profile retrieved', { user }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user profile & role
 * PUT /api/auth/profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const result = await authService.updateProfile(req.user.id, req.body);
    return successResponse(res, 'Profile updated successfully', result, 200);
  } catch (error) {
    next(error);
  }
};

