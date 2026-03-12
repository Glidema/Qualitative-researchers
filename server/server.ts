import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRedis, LIST_KEY, clearRedisCache } from '../api/lib/redis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 3000;

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

const app = express();
app.use(express.json({ limit: '1mb' }));

// POST /api/submit
app.post('/api/submit', async (req, res) => {
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
  const payload = JSON.stringify(item);

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const redis = await getRedis();
      if (!redis) {
        return res.status(503).json({
          error: '未配置存储：请设置环境变量 REDIS_URL（redis:// 连接串），然后重启服务。',
        });
      }
      await redis.lpush(LIST_KEY, payload);
      return res.status(200).json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`submit error (attempt ${attempt}/${maxAttempts}):`, msg, e);
      clearRedisCache();
      if (attempt === maxAttempts) {
        return res.status(500).json({
          error: '服务器写入失败，请稍后重试。请确认 REDIS_URL 可连接。',
        });
      }
    }
  }
  return res.status(500).json({ error: '服务器写入失败，请稍后重试。' });
});

// GET /api/results（需管理员密码）
app.get('/api/results', async (req, res) => {
  const password = req.headers['x-admin-password'] as string | undefined;
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(503).json({
      error: '未配置 ADMIN_SECRET：请设置环境变量 ADMIN_SECRET（与管理员登录密码一致）并重启。',
    });
  }
  if (password !== secret) {
    return res.status(401).json({ error: '未授权：密码错误或与 ADMIN_SECRET 不一致。' });
  }

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const redis = await getRedis();
      if (!redis) {
        return res.status(503).json({
          error: '未配置存储或 Redis 连接失败：请检查 REDIS_URL。',
        });
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
          error: '加载数据失败，请稍后再试。请确认 REDIS_URL 可连接。',
        });
      }
    }
  }
  return res.status(500).json({ error: '加载数据失败，请重试。' });
});

// 静态资源 + SPA 回退
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
