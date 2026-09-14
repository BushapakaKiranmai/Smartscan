const { ROLES } = require('../constants/roles');
const { errorResponse } = require('../utils/apiResponse');

/**
 * Enforces branch isolation for BRANCH_STAFF and BRANCH_MANAGER.
 * Checks branchId from req.params, req.query, or req.body against user.assignedBranchIds.
 */
const enforceBranchAccess = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return errorResponse(res, 'Authentication required.', null, 401);
  }

  // Super Admin has unrestricted access across all branches
  if (user.role === ROLES.SUPER_ADMIN) {
    return next();
  }

  // Customers do not have staff-level branch management access
  if (user.role === ROLES.CUSTOMER) {
    return errorResponse(res, 'Customers are not authorized for branch administrative access.', null, 403);
  }

  // Extract branchId from params, query, or body
  const targetBranchId = req.params.branchId || req.query.branchId || req.body.branchId;

  if (!targetBranchId) {
    return errorResponse(res, 'Target branch ID must be specified for this operation.', null, 400);
  }

  // Check if target branch is among user's assigned branches
  const assigned = user.assignedBranchIds.map(id => id.toString());
  if (!assigned.includes(targetBranchId.toString())) {
    return errorResponse(
      res,
      'Forbidden: You are not authorized to view or manage resources for this branch.',
      null,
      403
    );
  }

  next();
};

module.exports = {
  enforceBranchAccess
};
