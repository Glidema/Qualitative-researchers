import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const LIST_KEY = 'quiz:results';

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
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return res.status(503).json({
        error: 'Storage not configured.',
      });
    }

    const raw = await kv.lrange<string>(LIST_KEY, 0, 999);
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
