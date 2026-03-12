import { createClient as createVercelKv } from '@vercel/kv';
import { createClient as createNodeRedis } from 'redis';

const LIST_KEY = 'quiz:results';
export { LIST_KEY };

export type RedisAdapter = {
  lpush(key: string, ...values: string[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
};

let cachedAdapter: RedisAdapter | null = null;

/** 出错时可由 API 调用，下次请求会重新建连 */
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

/** 与 Vercel Redis 集成（如 redis-cyan-river）一致：优先用 REDIS_URL，同进程内复用连接 */
export async function getRedis(): Promise<RedisAdapter | null> {
  const url =
    process.env.REDIS_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.STORAGE_REST_API_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_TOKEN ||
    process.env.STORAGE_REST_API_TOKEN;

  // 1) REDIS_URL 若为 https://（Upstash REST）且存在 token，走 REST，不尝试 TCP
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && redisUrl.startsWith('https://') && token) {
    const kv = createVercelKv({ url: redisUrl, token });
    return {
      lpush: (key: string, ...values: string[]) => kv.lpush(key, ...(values as any)),
      lrange: (key: string, start: number, stop: number) => kv.lrange(key, start, stop),
    };
  }

  // 2) REDIS_URL 为 redis:// / rediss:// → node-redis TCP，同进程内复用
  if (redisUrl && (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://'))) {
    try {
      if (cachedAdapter) return cachedAdapter;
      const client = createNodeRedis({ url: redisUrl });
      await client.connect();
      cachedAdapter = makeAdapter(client);
      return cachedAdapter;
    } catch (e) {
      console.error('Redis connect error:', e);
      cachedAdapter = null;
      return null;
    }
  }

  // 3) 其他 redis:// / rediss:// URL（如 KV_REST_API_* 未设但 URL 是 redis://）
  if (url && (url.startsWith('redis://') || url.startsWith('rediss://'))) {
    try {
      if (cachedAdapter) return cachedAdapter;
      const client = createNodeRedis({ url });
      await client.connect();
      cachedAdapter = makeAdapter(client);
      return cachedAdapter;
    } catch (e) {
      console.error('Redis TCP connect error:', e);
      cachedAdapter = null;
      return null;
    }
  }

  // 4) HTTPS REST（Upstash）→ URL + Token，用 @vercel/kv
  if (url && token) {
    const kv = createVercelKv({ url, token });
    return {
      lpush: (key: string, ...values: string[]) => kv.lpush(key, ...(values as any)),
      lrange: (key: string, start: number, stop: number) => kv.lrange(key, start, stop),
    };
  }

  // 5) 未配置 Redis 时使用进程内内存存储（重启后数据丢失，适合先跑通再配 Redis）
  return getMemoryAdapter();
}

const memoryStore = new Map<string, string[]>();

function getMemoryAdapter(): RedisAdapter {
  return {
    lpush: async (key: string, ...values: string[]) => {
      let list = memoryStore.get(key);
      if (!list) {
        list = [];
        memoryStore.set(key, list);
      }
      for (const v of values) list.unshift(v);
      return list.length;
    },
    lrange: async (key: string, start: number, stop: number) => {
      const list = memoryStore.get(key) ?? [];
      const len = list.length;
      const s = start < 0 ? Math.max(0, len + start) : start;
      const e = stop < 0 ? Math.max(0, len + stop) : stop;
      return list.slice(s, e + 1);
    },
  };
}
