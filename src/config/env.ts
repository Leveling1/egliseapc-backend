import 'dotenv/config';

import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

const developmentApiKey = 'development-only-change-this-api-key';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  SWAGGER_ENABLED: booleanFromString,
  DATABASE_URL: z
    .url()
    .startsWith('postgresql://')
    .default('postgresql://egliseapc:change-me@localhost:5432/egliseapc'),
  DATABASE_HOST: z.string().min(1).optional(),
  POSTGRES_DB: z.string().min(1).default('egliseapc'),
  POSTGRES_USER: z.string().min(1).default('egliseapc'),
  POSTGRES_PASSWORD: z.string().min(1).default('change-me'),
  REDIS_URL: z
    .url()
    .refine((url) => url.startsWith('redis://') || url.startsWith('rediss://'), {
      message: 'REDIS_URL doit utiliser le protocole redis:// ou rediss://',
    })
    .default('redis://:change-me@localhost:6379'),
  REDIS_HOST: z.string().min(1).optional(),
  REDIS_PORT: z.coerce.number().int().min(1).max(65_535).default(6379),
  REDIS_PASSWORD: z.string().min(1).default('change-me'),
  INTEGRATION_API_KEY: z.string().min(32).default(developmentApiKey),
  MEDIA_STORAGE_PATH: z.string().min(1).default('./uploads'),
  MEDIA_PUBLIC_BASE_URL: z.url().default('http://localhost:3000/media'),
  MEDIA_MAX_FILE_SIZE_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(20 * 1_024 * 1_024)
    .default(5 * 1_024 * 1_024),
  MEDIA_MAX_INPUT_PIXELS: z.coerce
    .number()
    .int()
    .min(1_000_000)
    .max(100_000_000)
    .default(40_000_000),
  MEDIA_UPLOAD_RATE_LIMIT: z.coerce.number().int().min(1).max(1_000).default(30),
  MEDIA_PUBLIC_CACHE_SECONDS: z.coerce.number().int().min(0).max(31_536_000).default(31_536_000),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = z.prettifyError(parsedEnv.error);
  throw new Error(`Configuration invalide :\n${details}`);
}

if (
  parsedEnv.data.NODE_ENV === 'production' &&
  parsedEnv.data.INTEGRATION_API_KEY === developmentApiKey
) {
  throw new Error(
    'Configuration invalide : INTEGRATION_API_KEY doit être remplacée en production.',
  );
}

const mediaPublicBaseUrl = new URL(parsedEnv.data.MEDIA_PUBLIC_BASE_URL);
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

if (parsedEnv.data.NODE_ENV === 'production') {
  if (mediaPublicBaseUrl.protocol !== 'https:') {
    throw new Error(
      'Configuration invalide : MEDIA_PUBLIC_BASE_URL doit utiliser HTTPS en production.',
    );
  }

  if (localHosts.has(mediaPublicBaseUrl.hostname)) {
    throw new Error(
      'Configuration invalide : MEDIA_PUBLIC_BASE_URL ne doit pas pointer vers localhost en production.',
    );
  }
}

export const env = parsedEnv.data;
export const allowedOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
