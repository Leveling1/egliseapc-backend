import { Router } from 'express';

import { healthRouter } from './modules/health/health.routes.js';
import { createMediaRouter } from './modules/media/media.routes.js';
import type { MediaService } from './modules/media/media.service.js';

export function createApiRouter(mediaService: MediaService): Router {
  const router = Router();

  router.use('/health', healthRouter);
  router.use('/media', createMediaRouter(mediaService));
  return router;
}
