/**
 * Role definitions matching docs/DATABASE_DESIGN.md
 */
const ROLES = {
  CUSTOMER: 'CUSTOMER',
  BRANCH_STAFF: 'BRANCH_STAFF',
  BRANCH_MANAGER: 'BRANCH_MANAGER',
  SUPER_ADMIN: 'SUPER_ADMIN'
};

module.exports = {
  ROLES,
  ALL_ROLES: Object.values(ROLES)
};
