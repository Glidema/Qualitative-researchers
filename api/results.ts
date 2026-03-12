import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@vercel/kv';

const LIST_KEY = 'quiz:results';

function getKvClient() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.STORAGE_REST_API_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.STORAGE_REST_API_TOKEN;
  if (!url || !token) return null;
  return createClient({ url, token });
}

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
    const kv = getKvClient();
    if (!kv) {
      return res.status(503).json({ error: 'Storage not configured.' });
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
