import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, LIST_KEY } from './lib/redis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const password = (req.headers['x-admin-password'] ?? req.headers['X-Admin-Password']) as string | undefined;
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(503).json({ error: '未配置 ADMIN_SECRET：请在 Vercel 环境变量中设置 ADMIN_SECRET（与管理员登录密码一致）并重新部署。' });
  }
  if (password !== secret) {
    return res.status(401).json({ error: '未授权：密码错误或与 ADMIN_SECRET 不一致。' });
  }

  try {
    const redis = await getRedis();
    if (!redis) {
      return res.status(503).json({ error: '未配置存储：请确保 Vercel 环境变量中已设置 REDIS_URL 并重新部署。' });
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
    return res.status(500).json({ error: '服务器加载数据失败，请稍后重试。' });
  }
}
