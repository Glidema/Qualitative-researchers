import { createClient as createVercelKv } from '@vercel/kv';
import { createClient as createNodeRedis } from 'redis';

const LIST_KEY = 'quiz:results';
export { LIST_KEY };

export type RedisAdapter = {
  lpush(key: string, ...values: string[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
};

/** 与 Vercel Redis 集成（如 redis-cyan-river）一致：优先用 REDIS_URL + node-redis 无参/带 url */
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

  // 1) REDIS_URL（redis-cyan-river 等注入）→ 用 node-redis，与官方文档一致
  if (process.env.REDIS_URL) {
    try {
      const client = createNodeRedis({ url: process.env.REDIS_URL });
      await client.connect();
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
    } catch (e) {
      console.error('Redis connect error:', e);
      return null;
    }
  }

  // 2) 其他 redis:// / rediss:// URL
  if (url && (url.startsWith('redis://') || url.startsWith('rediss://'))) {
    try {
      const client = createNodeRedis({ url });
      await client.connect();
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
    } catch (e) {
      console.error('Redis TCP connect error:', e);
      return null;
    }
  }

  // 3) HTTPS REST（Upstash）→ URL + Token，用 @vercel/kv
  if (url && token) {
    const kv = createVercelKv({ url, token });
    return {
      lpush: (key: string, ...values: string[]) => kv.lpush(key, ...(values as any)),
      lrange: (key: string, start: number, stop: number) => kv.lrange(key, start, stop),
    };
  }

  return null;
}
