import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';
import { getStudentWeaknessProfile, getAllStudentsWeaknessSummary } from '../services/weakness-analysis';

export const weaknessRoutes = new Hono<{ Bindings: Env }>();

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
  const adminSecret = c.req.header('x-admin-secret');
  if (adminSecret !== 'bayuganteng') {
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
  const adminSecret = c.req.header('x-admin-secret');
  if (adminSecret !== 'bayuganteng') {
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
