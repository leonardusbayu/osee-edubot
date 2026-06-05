/**
 * Multi-role helpers
 *
 * A user can have a primary role (users.role, single string) PLUS additional
 * roles stored in users.roles (comma-separated). For example, a teacher who
 * is also a reseller has:
 *   role = 'teacher'        (primary, set first)
 *   roles = 'reseller'      (additional, set on second promotion)
 *
 * Existing user.role === 'X' checks continue to work for users with a
 * single role. New code should use userHasRole() to check BOTH columns.
 *
 * Why two columns instead of one comma-separated? The codebase has ~30+
 * role-check sites that compare user.role to a literal. Changing role
 * to 'teacher,reseller' would break all of them. Keeping role single-valued
 * + adding a separate roles[] column = backward compatible.
 */

export type UserRole = 'student' | 'teacher' | 'reseller' | 'admin';

/**
 * Check if a user has a specific role. Checks BOTH the primary role and
 * the comma-separated additional roles.
 */
export function userHasRole(user: { role?: string | null; roles?: string | null } | null | undefined, role: UserRole): boolean {
  if (!user) return false;
  if (user.role === role) return true;
  if (!user.roles) return false;
  return user.roles.split(',').map((r) => r.trim()).includes(role);
}

/**
 * Get all roles a user has, including the primary. Returns a deduplicated
 * array of role strings.
 */
export function getAllRoles(user: { role?: string | null; roles?: string | null } | null | undefined): UserRole[] {
  if (!user) return [];
  const all = [user.role, ...(user.roles?.split(',').map((r) => r.trim()) || [])]
    .filter((r): r is string => !!r && r.length > 0);
  return Array.from(new Set(all)) as UserRole[];
}

/**
 * Promote a user to a new role. If the user already has a primary role,
 * the new role is APPENDED to the `roles` column instead of overwriting.
 * This preserves backward compatibility with `user.role === 'X'` checks.
 *
 * Returns the new primary role and the new roles[] string.
 */
export interface PromoteResult {
  newRole: string | null;
  newRoles: string | null;
  wasPromoted: boolean; // false if user already had this role
}

export function addRoleToUser(
  existingRole: string | null,
  existingRoles: string | null,
  newRole: UserRole
): PromoteResult {
  // If user already has this role in either column, no-op
  const allCurrentRoles = [existingRole, ...(existingRoles?.split(',').map((r) => r.trim()) || [])]
    .filter((r): r is string => !!r && r.length > 0);
  if (allCurrentRoles.includes(newRole)) {
    return { newRole: existingRole, newRoles: existingRoles, wasPromoted: false };
  }

  // If user has no primary role, set as primary. Otherwise append to roles.
  if (!existingRole) {
    return { newRole, newRoles: existingRoles, wasPromoted: true };
  }

  // Append. Keep the original primary.
  const newRoles = existingRoles
    ? `${existingRoles},${newRole}`
    : newRole;
  return { newRole: existingRole, newRoles, wasPromoted: true };
}
