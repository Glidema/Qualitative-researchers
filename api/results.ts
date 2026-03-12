import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, LIST_KEY } from './lib/redis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const password = req.headers['x-admin-password'] as string | undefined;
  const secret = process.env.ADMIN_SECRET;
  if (!secret || password !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const redis = await getRedis();
    if (!redis) {
      return res.status(503).json({ error: 'Storage not configured.' });
    }

    const raw = await redis.lrange(LIST_KEY, 0, 999);
    const results = (raw || [])
      .map((s) => {
        if (typeof s !== 'string') return null;
        try {
          return JSON.parse(s);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return res.status(200).json(results);
  } catch (e) {
    console.error('results error:', e);
    return res.status(500).json({ error: 'Failed to load results' });
  }
}
