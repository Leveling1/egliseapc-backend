import type { Server } from 'node:http';

import { closeRedis, connectRedis } from './cache/redis.js';
import { checkPostgres, closePostgres } from './database/postgres.js';
import { logger } from '../shared/logger.js';

export async function connectInfrastructure(): Promise<void> {
  await Promise.all([checkPostgres(), connectRedis()]);
  logger.info('Connexions PostgreSQL et Redis établies');
}

export function registerGracefulShutdown(server: Server): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Arrêt gracieux en cours');

    server.close(async (serverError) => {
      const results = await Promise.allSettled([closePostgres(), closeRedis()]);
      const dependencyError = results.find((result) => result.status === 'rejected');

      if (serverError || dependencyError) {
        logger.error({ err: serverError, dependencyError }, "Échec pendant l'arrêt");
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}
