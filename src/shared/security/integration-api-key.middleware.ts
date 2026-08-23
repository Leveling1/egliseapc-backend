import { timingSafeEqual } from 'node:crypto';

import type { RequestHandler } from 'express';

import { env } from '../../config/env.js';
import { HttpError } from '../http/http-error.js';

function matchesExpectedKey(receivedKey: string): boolean {
  const expected = Buffer.from(env.INTEGRATION_API_KEY, 'utf8');
  const received = Buffer.from(receivedKey, 'utf8');

  return expected.length === received.length && timingSafeEqual(expected, received);
}

export const requireIntegrationApiKey: RequestHandler = (request, _response, next) => {
  const receivedKey = request.get('x-api-key');

  if (!receivedKey || !matchesExpectedKey(receivedKey)) {
    next(
      new HttpError(401, 'Client non autorisé', "La clé d'intégration est absente ou invalide."),
    );
    return;
  }

  next();
};
