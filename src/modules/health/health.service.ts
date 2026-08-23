import { checkRedis } from '../../infra/cache/redis.js';
import { checkPostgres } from '../../infra/database/postgres.js';
import { localMediaStorage } from '../media/media.dependencies.js';

type DependencyStatus = 'up' | 'down';

export interface ReadinessReport {
  status: 'ready' | 'not_ready';
  dependencies: {
    postgres: DependencyStatus;
    redis: DependencyStatus;
    mediaStorage: DependencyStatus;
  };
  timestamp: string;
}

export async function getReadiness(): Promise<ReadinessReport> {
  const [postgresResult, redisResult, mediaStorageResult] = await Promise.allSettled([
    checkPostgres(),
    checkRedis(),
    localMediaStorage.ensureReady(),
  ]);
  const dependencies = {
    postgres: postgresResult.status === 'fulfilled' ? 'up' : 'down',
    redis: redisResult.status === 'fulfilled' ? 'up' : 'down',
    mediaStorage: mediaStorageResult.status === 'fulfilled' ? 'up' : 'down',
  } satisfies ReadinessReport['dependencies'];

  return {
    status: Object.values(dependencies).every((status) => status === 'up') ? 'ready' : 'not_ready',
    dependencies,
    timestamp: new Date().toISOString(),
  };
}
