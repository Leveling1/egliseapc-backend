import { createClient } from 'redis';

import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';

export const redis = createClient(
  env.REDIS_HOST
    ? {
        socket: { host: env.REDIS_HOST, port: env.REDIS_PORT },
        password: env.REDIS_PASSWORD,
      }
    : { url: env.REDIS_URL },
);

redis.on('error', (error: Error) => {
  logger.error({ err: error }, 'Erreur du client Redis');
});

export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) await redis.connect();
}

export async function checkRedis(): Promise<void> {
  if (!redis.isReady) throw new Error('Redis indisponible');
  await redis.ping();
}

export async function closeRedis(): Promise<void> {
  if (redis.isOpen) await redis.close();
}
