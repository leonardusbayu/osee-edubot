import { Hono } from 'hono';
import type { Env } from '../types';
import { validateInitDataAsync, createJWT } from '../services/auth';

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.post('/login', async (c) => {
  const { init_data } = await c.req.json();
  if (!init_data) return c.json({ error: 'Missing init_data' }, 400);

  const tgUser = await validateInitDataAsync(init_data, c.env.TELEGRAM_BOT_TOKEN);
  if (!tgUser) return c.json({ error: 'Invalid authentication' }, 401);

  // Get or create user
  let user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE telegram_id = ?'
  ).bind(tgUser.id).first();

  if (!user) {
    const name = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() || 'User';
    await c.env.DB.prepare(
      'INSERT INTO users (telegram_id, name, username) VALUES (?, ?, ?)'
    ).bind(tgUser.id, name, tgUser.username || null).run();

    user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    ).bind(tgUser.id).first();
  }

  if (!user) return c.json({ error: 'Failed to create user' }, 500);

  const accessToken = await createJWT(
    {
      sub: String(user.id),
      telegram_id: tgUser.id,
      role: user.role as string,
      exp: Math.floor(Date.now() / 1000) + 3600,
      type: 'access',
    },
    c.env.JWT_SECRET,
  );

  const refreshToken = await createJWT(
    {
      sub: String(user.id),
      telegram_id: tgUser.id,
      role: user.role as string,
      exp: Math.floor(Date.now() / 1000) + 7 * 86400,
      type: 'refresh',
    },
    c.env.JWT_SECRET,
  );

  return c.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    user: {
      id: user.id,
      telegram_id: user.telegram_id,
      role: user.role,
      name: user.name,
      username: user.username,
      target_test: user.target_test,
      proficiency_level: user.proficiency_level,
      onboarding_complete: !!user.onboarding_complete,
    },
  });
});

authRoutes.post('/refresh', async (c) => {
  const { refresh_token } = await c.req.json();
  if (!refresh_token) return c.json({ error: 'Missing refresh_token' }, 400);

  const { verifyJWT } = await import('../services/auth');
  const payload = await verifyJWT(refresh_token, c.env.JWT_SECRET);
  if (!payload || payload.type !== 'refresh') return c.json({ error: 'Invalid token' }, 401);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(parseInt(payload.sub)).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  const accessToken = await createJWT(
    {
      sub: String(user.id),
      telegram_id: user.telegram_id as number,
      role: user.role as string,
      exp: Math.floor(Date.now() / 1000) + 3600,
      type: 'access',
    },
    c.env.JWT_SECRET,
  );

  const newRefreshToken = await createJWT(
    {
      sub: String(user.id),
      telegram_id: user.telegram_id as number,
      role: user.role as string,
      exp: Math.floor(Date.now() / 1000) + 7 * 86400,
      type: 'refresh',
    },
    c.env.JWT_SECRET,
  );

  return c.json({
    access_token: accessToken,
    refresh_token: newRefreshToken,
    token_type: 'bearer',
    user: {
      id: user.id,
      telegram_id: user.telegram_id,
      role: user.role,
      name: user.name,
      username: user.username,
      target_test: user.target_test,
      proficiency_level: user.proficiency_level,
      onboarding_complete: !!user.onboarding_complete,
    },
  });
});
