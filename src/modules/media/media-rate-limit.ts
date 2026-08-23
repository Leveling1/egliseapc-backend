import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

import { env } from '../../config/env.js';
import { redis } from '../../infra/cache/redis.js';

export function createMediaUploadRateLimit(): RequestHandler {
  const store =
    env.NODE_ENV === 'test'
      ? undefined
      : new RedisStore({
          prefix: 'rate-limit:media-upload:',
          sendCommand: (...args: string[]) => redis.sendCommand(args),
        });

  return rateLimit({
    windowMs: 60_000,
    limit: env.MEDIA_UPLOAD_RATE_LIMIT,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(store ? { store } : {}),
    handler: (_request, response) => {
      response.status(429).type('application/problem+json').json({
        type: 'about:blank',
        title: 'Trop de requêtes',
        status: 429,
        detail: "La limite d'uploads autorisés a été atteinte.",
        requestId: response.locals.requestId,
      });
    },
  });
}
