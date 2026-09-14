const { errorResponse } = require('../utils/apiResponse');

/**
 * Role-Based Access Control (RBAC) Middleware.
 * Usage: authorize(ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return errorResponse(res, 'Access denied. Unauthenticated request.', null, 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Access denied. Requires one of the following roles: [${allowedRoles.join(', ')}]`,
        null,
        403
      );
    }

    next();
  };
};

module.exports = {
  authorize
};
