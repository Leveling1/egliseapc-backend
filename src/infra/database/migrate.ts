import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { postgres } from './postgres.js';
import { logger } from '../../shared/logger.js';

const migrationsDirectory = resolve(process.cwd(), 'database', 'migrations');
const migrationNamePattern = /^\d{3}_[a-z0-9_]+\.sql$/;
const advisoryLockId = 1_614_164_950;

interface AppliedMigration {
  version: string;
  checksum: string;
}

async function ensureMigrationsTable(): Promise<void> {
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function loadAppliedMigrations(): Promise<Map<string, string>> {
  const result = await postgres.query<AppliedMigration>(
    'SELECT version, checksum FROM schema_migrations ORDER BY version',
  );
  return new Map(result.rows.map(({ version, checksum }) => [version, checksum]));
}

async function applyMigration(filename: string, sql: string, checksum: string): Promise<void> {
  const client = await postgres.connect();

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [
      filename,
      checksum,
    ]);
    await client.query('COMMIT');
    logger.info({ migration: filename }, 'Migration SQL appliquée');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function migrate(): Promise<void> {
  await postgres.query('SELECT pg_advisory_lock($1)', [advisoryLockId]);

  try {
    await ensureMigrationsTable();
    const applied = await loadAppliedMigrations();
    const filenames = (await readdir(migrationsDirectory))
      .filter((filename) => migrationNamePattern.test(filename))
      .sort();

    for (const filename of filenames) {
      const sql = await readFile(resolve(migrationsDirectory, filename), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previousChecksum = applied.get(filename);

      if (previousChecksum && previousChecksum !== checksum) {
        throw new Error(`La migration déjà appliquée ${filename} a été modifiée.`);
      }
      if (!previousChecksum) await applyMigration(filename, sql, checksum);
    }

    logger.info({ count: filenames.length }, 'Migrations SQL à jour');
  } finally {
    await postgres.query('SELECT pg_advisory_unlock($1)', [advisoryLockId]);
  }
}

const entrypoint = process.argv[1] ? resolve(process.argv[1]) : '';

if (fileURLToPath(import.meta.url) === entrypoint) {
  migrate()
    .catch((error: unknown) => {
      logger.fatal({ err: error }, 'Échec des migrations SQL');
      process.exitCode = 1;
    })
    .finally(async () => postgres.end());
}
