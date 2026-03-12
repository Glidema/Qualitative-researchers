import { createClient as createVercelKv } from '@vercel/kv';
import { createClient as createNodeRedis } from 'redis';

const LIST_KEY = 'quiz:results';
export { LIST_KEY };

export type RedisAdapter = {
  lpush(key: string, ...values: string[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
};

/** 支持 redis://（Redis Labs 等）或 Upstash REST（URL + Token） */
export async function getRedis(): Promise<RedisAdapter | null> {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_URL ||
    process.env.STORAGE_REST_API_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_TOKEN ||
    process.env.STORAGE_REST_API_TOKEN;

  if (!url) return null;

  // redis:// 或 rediss:// → TCP 连接（Redis Labs 等），用 node-redis
  if (url.startsWith('redis://') || url.startsWith('rediss://')) {
    const client = createNodeRedis({ url });
    await client.connect();
    return {
      lpush: (key: string, ...values: string[]) => client.lPush(key, ...values),
      lrange: (key: string, start: number, stop: number) => client.lRange(key, start, stop),
    };
  }

  // HTTPS REST（Upstash）→ 需要 URL + Token，用 @vercel/kv
  if (token) {
    const kv = createVercelKv({ url, token });
    return {
      lpush: (key: string, ...values: string[]) => kv.lpush(key, ...(values as any)),
      lrange: (key: string, start: number, stop: number) => kv.lrange(key, start, stop),
    };
  }

  return null;
}
