import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';

export const mediaRoutes = new Hono<{ Bindings: Env }>();

mediaRoutes.post('/upload', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  if (!c.env.MEDIA) {
    return c.json({ error: 'R2 storage not configured. Enable R2 in Cloudflare Dashboard.' }, 501);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'No file' }, 400);

  const ext = file.name.split('.').pop() || 'bin';
  const key = `uploads/${crypto.randomUUID()}.${ext}`;

  await c.env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  return c.json({
    key,
    url: `/api/media/${key}`,
    size: file.size,
  });
});

mediaRoutes.post('/recording', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  if (!c.env.MEDIA) {
    return c.json({ error: 'R2 storage not configured' }, 501);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'No file' }, 400);

  const key = `recordings/${user.id}/${crypto.randomUUID()}.webm`;

  await c.env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: 'audio/webm' },
  });

  return c.json({
    key,
    url: `/api/media/${key}`,
    size: file.size,
  });
});

mediaRoutes.get('/:key{.+}', async (c) => {
  if (!c.env.MEDIA) {
    return c.json({ error: 'R2 not configured' }, 501);
  }

  const key = c.req.param('key');
  const object = await c.env.MEDIA.get(key);

  if (!object) return c.json({ error: 'Not found' }, 404);

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=86400');

  return new Response(object.body, { headers });
});
