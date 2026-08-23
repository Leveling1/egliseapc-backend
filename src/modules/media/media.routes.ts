import { Router } from 'express';

import { requireIntegrationApiKey } from '../../shared/security/integration-api-key.middleware.js';
import { createGetPublicMediaHandler, createUploadMediaHandler } from './media.controller.js';
import { createMediaUploadRateLimit } from './media-rate-limit.js';
import type { MediaService } from './media.service.js';
import { mediaUploadMiddleware } from './media-upload.middleware.js';

export function createMediaRouter(service: MediaService): Router {
  const router = Router();
  const mediaUploadRateLimit = createMediaUploadRateLimit();

  router.post(
    '/',
    requireIntegrationApiKey,
    mediaUploadRateLimit,
    mediaUploadMiddleware,
    createUploadMediaHandler(service),
  );

  return router;
}

export function createPublicMediaRouter(service: MediaService): Router {
  const router = Router();
  router.get('/:filename', createGetPublicMediaHandler(service));
  return router;
}
