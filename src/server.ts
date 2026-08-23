import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectInfrastructure, registerGracefulShutdown } from './infra/lifecycle.js';
import { logger } from './shared/logger.js';

async function start(): Promise<void> {
  await connectInfrastructure();

  const app = createApp();
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'API démarrée');
  });

  registerGracefulShutdown(server);
}

start().catch((error: unknown) => {
  logger.fatal({ err: error }, "Impossible de démarrer l'API");
  process.exitCode = 1;
});
