-- 089: Multi-role support
-- A user can have ONE primary role (the original role column) PLUS a list
-- of additional roles stored in `roles` (comma-separated). E.g. BUDI the
-- teacher becomes a reseller: role='teacher', roles='reseller'. The auth
-- helper userHasRole(user, role) checks both.
--
-- Why not just put everything in `role`? The codebase has ~30 existing
-- `user.role === 'teacher'` / `!== 'admin'` checks. If `role` becomes
-- 'teacher,reseller', all those checks break. Adding a separate `roles`
-- column keeps the old checks working for users with a single role.

ALTER TABLE users ADD COLUMN roles TEXT;

-- Backfill: any user with a non-standard primary role that should be in
-- `roles` instead. None expected — keep this empty for now; future migrations
-- can add INSERTs here if we ever need to migrate a multi-role.
