import { describe, it, expect } from 'vitest';
import { userHasRole, getAllRoles, addRoleToUser } from './user-roles';

describe('userHasRole', () => {
  it('returns true for matching primary role', () => {
    expect(userHasRole({ role: 'teacher' }, 'teacher')).toBe(true);
  });

  it('returns false for non-matching primary role', () => {
    expect(userHasRole({ role: 'student' }, 'reseller')).toBe(false);
  });

  it('checks the additional roles column for multi-role users', () => {
    expect(userHasRole({ role: 'teacher', roles: 'reseller' }, 'reseller')).toBe(true);
  });

  it('returns false when roles is null', () => {
    expect(userHasRole({ role: 'student', roles: null }, 'admin')).toBe(false);
  });

  it('handles comma-separated roles correctly', () => {
    expect(userHasRole({ role: 'student', roles: 'reseller,admin' }, 'admin')).toBe(true);
  });

  it('handles whitespace in roles', () => {
    expect(userHasRole({ role: 'student', roles: 'reseller, admin' }, 'admin')).toBe(true);
  });

  it('returns false for null user', () => {
    expect(userHasRole(null, 'admin')).toBe(false);
  });

  it('returns false for null role match', () => {
    expect(userHasRole({ role: null, roles: null }, 'admin')).toBe(false);
  });
});

describe('getAllRoles', () => {
  it('returns primary + additional roles deduplicated', () => {
    const roles = getAllRoles({ role: 'teacher', roles: 'reseller,teacher' });
    expect(roles.sort()).toEqual(['reseller', 'teacher']);
  });

  it('handles single role', () => {
    expect(getAllRoles({ role: 'student' })).toEqual(['student']);
  });

  it('handles null user', () => {
    expect(getAllRoles(null)).toEqual([]);
  });

  it('handles null primary and null roles', () => {
    expect(getAllRoles({ role: null, roles: null })).toEqual([]);
  });
});

describe('addRoleToUser', () => {
  it('sets new role as primary when no primary exists', () => {
    const result = addRoleToUser(null, null, 'reseller');
    expect(result.newRole).toBe('reseller');
    expect(result.newRoles).toBe(null);
    expect(result.wasPromoted).toBe(true);
  });

  it('appends to roles when primary exists', () => {
    const result = addRoleToUser('teacher', null, 'reseller');
    expect(result.newRole).toBe('teacher');  // unchanged
    expect(result.newRoles).toBe('reseller');
    expect(result.wasPromoted).toBe(true);
  });

  it('appends to existing additional roles', () => {
    const result = addRoleToUser('teacher', 'reseller', 'admin');
    expect(result.newRole).toBe('teacher');
    expect(result.newRoles).toBe('reseller,admin');
    expect(result.wasPromoted).toBe(true);
  });

  it('is idempotent if user already has the role in primary', () => {
    const result = addRoleToUser('reseller', null, 'reseller');
    expect(result.wasPromoted).toBe(false);
    expect(result.newRole).toBe('reseller');
  });

  it('is idempotent if user already has the role in additional', () => {
    const result = addRoleToUser('teacher', 'reseller', 'reseller');
    expect(result.wasPromoted).toBe(false);
    expect(result.newRoles).toBe('reseller');
  });
});
