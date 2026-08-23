import type { RequestHandler } from 'express';

import { getReadiness } from './health.service.js';

export const getLivenessHandler: RequestHandler = (_request, response) => {
  response.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
};

export const getReadinessHandler: RequestHandler = async (_request, response) => {
  const report = await getReadiness();
  response.status(report.status === 'ready' ? 200 : 503).json(report);
};
