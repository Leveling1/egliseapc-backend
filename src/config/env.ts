import 'dotenv/config';

import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

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
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = z.prettifyError(parsedEnv.error);
  throw new Error(`Configuration invalide :\n${details}`);
}

export const env = parsedEnv.data;
export const allowedOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
