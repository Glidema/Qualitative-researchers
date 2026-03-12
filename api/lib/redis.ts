import { createClient as createVercelKv } from '@vercel/kv';
import { createClient as createNodeRedis } from 'redis';

const LIST_KEY = 'quiz:results';
export { LIST_KEY };

export type RedisAdapter = {
  lpush(key: string, ...values: string[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
};

let cachedAdapter: RedisAdapter | null = null;

export function clearRedisCache() {
  cachedAdapter = null;
}

function makeAdapter(client: ReturnType<typeof createNodeRedis>): RedisAdapter {
  return {
    lpush: async (key: string, ...values: string[]) => {
      let n = 0;
      for (const v of values) {
        n = Number(await client.lPush(key, v));
      }
      return n;
    },
    lrange: async (key: string, start: number, stop: number) => {
      const raw = await client.lRange(key, start, stop);
      const arr = Array.isArray(raw) ? raw : [];
      return arr.map((x) => (typeof x === 'string' ? x : String(x)));
    },
  };
}

/**
 * 只认一个 Redis：环境变量 REDIS_URL。
 * - redis:// 或 rediss:// → TCP 连接（Railway 等）
 * - https:// 且配置了 REDIS_TOKEN → REST（如 Upstash），否则不用
 */
export async function getRedis(): Promise<RedisAdapter | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  // redis:// / rediss:// → 直接连 Redis（Railway 加 Redis 后会给这个）
  if (url.startsWith('redis://') || url.startsWith('rediss://')) {
    try {
      if (cachedAdapter) return cachedAdapter;
      const client = createNodeRedis({ url });
      await client.connect();
      cachedAdapter = makeAdapter(client);
      return cachedAdapter;
    } catch (e) {
      console.error('Redis connect error:', e);
      cachedAdapter = null;
      return null;
    }
  }

  // https://（Upstash REST）→ 需要 REDIS_TOKEN
  if (url.startsWith('https://') && process.env.REDIS_TOKEN) {
    const kv = createVercelKv({ url, token: process.env.REDIS_TOKEN });
    return {
      lpush: (key: string, ...values: string[]) => kv.lpush(key, ...(values as any)),
      lrange: (key: string, start: number, stop: number) => kv.lrange(key, start, stop),
    };
  }

  return null;
}
