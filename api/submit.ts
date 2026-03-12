import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, LIST_KEY } from './lib/redis';

interface SubmitBody {
  name: string;
  studentId: string;
  scores: Record<string, number>;
  resultTypes: string[];
}

function isValidScores(scores: unknown): scores is Record<string, number> {
  if (!scores || typeof scores !== 'object') return false;
  const keys = ['newPositivism', 'originalism', 'constructivism', 'criticalTheory'];
  for (const k of keys) {
    if (typeof (scores as Record<string, number>)[k] !== 'number') return false;
  }
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = await getRedis();
    if (!redis) {
      return res.status(503).json({
        error: '未配置存储：请在 Vercel 环境变量中设置 REDIS_URL（redis:// 连接串）或 Upstash 的 URL+Token，然后重新部署。',
      });
    }

    const body = req.body as SubmitBody;
    if (
      !body ||
      typeof body.name !== 'string' ||
      typeof body.studentId !== 'string' ||
      !Array.isArray(body.resultTypes) ||
      !isValidScores(body.scores)
    ) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const name = body.name.trim();
    const studentId = body.studentId.trim();
    if (!name || !studentId) {
      return res.status(400).json({ error: 'name and studentId required' });
    }

    const item = {
      name,
      studentId,
      scores: body.scores,
      resultTypes: body.resultTypes,
      createdAt: new Date().toISOString(),
    };

    await redis.lpush(LIST_KEY, JSON.stringify(item));

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('submit error:', e);
    return res.status(500).json({ error: '服务器写入失败，请稍后重试。' });
  }
}
