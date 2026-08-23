import pg from 'pg';

import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';

const connection = env.DATABASE_HOST
  ? {
      host: env.DATABASE_HOST,
      port: 5432,
      database: env.POSTGRES_DB,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
    }
  : { connectionString: env.DATABASE_URL };

export const postgres = new pg.Pool({
  ...connection,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

postgres.on('error', (error) => {
  logger.error({ err: error }, 'Erreur inattendue sur une connexion PostgreSQL inactive');
});

export async function checkPostgres(): Promise<void> {
  await postgres.query('SELECT 1');
}

export async function closePostgres(): Promise<void> {
  await postgres.end();
}
