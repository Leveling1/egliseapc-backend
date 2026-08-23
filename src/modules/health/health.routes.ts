import { Router } from 'express';

import { getLivenessHandler, getReadinessHandler } from './health.controller.js';

export const healthRouter = Router();

healthRouter.get('/live', getLivenessHandler);
healthRouter.get('/ready', getReadinessHandler);
