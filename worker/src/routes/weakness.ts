import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';
import { getStudentWeaknessProfile, getAllStudentsWeaknessSummary } from '../services/weakness-analysis';

export const weaknessRoutes = new Hono<{ Bindings: Env }>();

// P0 #5: admin auth now reads from ADMIN_API_KEY secret (already deployed).
// Previously the literal 'bayuganteng' was hard-coded here AND in the
// frontend VITE_ADMIN_SECRET, so anyone reading the public frontend bundle
// could call admin APIs. Now: secret-only check, with safe fallback to
// ADMIN_SECRET for backwards compat during the migration window.

// Get current user's weakness profile (for student)
weaknessRoutes.get('/my-profile', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user?.id) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const profile = await getStudentWeaknessProfile(c.env, user.id, user.name || 'Student');
  return c.json(profile);
});

// Get all students weakness profiles (admin only)
weaknessRoutes.get('/all-students', async (c) => {
  if (!isAdminAuthorized(c.req.raw, c.env)) {
    return c.json({ error: 'Unauthorized - Admin only' }, 401);
  }

  try {
    const summary = await getAllStudentsWeaknessSummary(c.env);
    return c.json(summary);
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to get weakness profiles' }, 500);
  }
});

// Get specific student weakness profile (admin/teacher)
weaknessRoutes.get('/student/:userId', async (c) => {
  if (!isAdminAuthorized(c.req.raw, c.env)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = parseInt(c.req.param('userId'));

  // Get user name
  const userResult = await c.env.DB.prepare(
    'SELECT name FROM users WHERE id = ?'
  ).bind(userId).first() as any;

  if (!userResult) {
    return c.json({ error: 'User not found' }, 404);
  }

  try {
    const profile = await getStudentWeaknessProfile(c.env, userId, userResult.name || 'Unknown');
    return c.json(profile);
  } catch (err) {
    console.error('Error generating weakness profile:', err);
    return c.json({ error: 'Internal error', details: String(err) }, 500);
  }
});

// P0 #5: single source of truth for admin auth. Reads x-admin-secret OR
// Authorization: Bearer header, matches against ADMIN_API_KEY (preferred)
// or ADMIN_SECRET (legacy). Returns false if neither secret is configured
// (fails closed — better to lock admins out than expose data).
function isAdminAuthorized(req: Request, env: Env): boolean {
  const headerSecret = req.headers.get('x-admin-secret') || '';
  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : '';

  const provided = headerSecret || bearerToken;
  if (!provided) return false;

  // Prefer ADMIN_API_KEY (already a deployed Cloudflare secret), fall back
  // to ADMIN_SECRET for transitional compat. The literal 'bayuganteng' is
  // no longer accepted.
  const valid = env.ADMIN_API_KEY || env.ADMIN_SECRET;
  if (!valid) return false;

  return provided === valid;
}
