import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, LIST_KEY, clearRedisCache } from './lib/redis';

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

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const redis = await getRedis();
      if (!redis) {
        return res.status(503).json({ error: '未配置存储或 Redis 连接失败：请检查 REDIS_URL 是否正确，且 Vercel 可访问你的 Redis 服务。' });
      }

      const raw = await redis.lrange(LIST_KEY, 0, 999);
      const list = Array.isArray(raw) ? raw : [];
      const results = list
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
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`results error (attempt ${attempt}/${maxAttempts}):`, msg, e);
      clearRedisCache();
      if (attempt === maxAttempts) {
        return res.status(500).json({
          error: '加载数据失败，请稍后再点「刷新」重试。若多次失败，请确认 REDIS_URL 可被 Vercel 访问。',
        });
      }
    }
  }

  return res.status(500).json({ error: '加载数据失败，请重试。' });
}
