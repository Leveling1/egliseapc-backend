import { checkRedis } from '../../infra/cache/redis.js';
import { checkPostgres } from '../../infra/database/postgres.js';

type DependencyStatus = 'up' | 'down';

export interface ReadinessReport {
  status: 'ready' | 'not_ready';
  dependencies: {
    postgres: DependencyStatus;
    redis: DependencyStatus;
  };
  timestamp: string;
}

export async function getReadiness(): Promise<ReadinessReport> {
  const [postgresResult, redisResult] = await Promise.allSettled([checkPostgres(), checkRedis()]);
  const dependencies = {
    postgres: postgresResult.status === 'fulfilled' ? 'up' : 'down',
    redis: redisResult.status === 'fulfilled' ? 'up' : 'down',
  } satisfies ReadinessReport['dependencies'];

  return {
    status: dependencies.postgres === 'up' && dependencies.redis === 'up' ? 'ready' : 'not_ready',
    dependencies,
    timestamp: new Date().toISOString(),
  };
}
