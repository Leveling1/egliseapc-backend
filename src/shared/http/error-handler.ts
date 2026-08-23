import type { ErrorRequestHandler, RequestHandler } from 'express';

import { env } from '../../config/env.js';
import { HttpError } from './http-error.js';
import { logger } from '../logger.js';

export const notFoundHandler: RequestHandler = (request, response) => {
  response
    .status(404)
    .type('application/problem+json')
    .json({
      type: 'about:blank',
      title: 'Ressource introuvable',
      status: 404,
      detail: `${request.method} ${request.originalUrl} n'existe pas.`,
      requestId: response.locals.requestId,
    });
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const normalizedError = error as unknown;
  const isHttpError = normalizedError instanceof HttpError;
  const status = isHttpError ? normalizedError.status : 500;

  const log = status >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log(
    { err: normalizedError, method: request.method, path: request.originalUrl },
    'Requête HTTP rejetée',
  );

  response
    .status(status)
    .type('application/problem+json')
    .json({
      type: 'about:blank',
      title: isHttpError ? normalizedError.title : 'Erreur interne du serveur',
      status,
      ...(isHttpError
        ? { detail: normalizedError.message }
        : env.NODE_ENV === 'development' && normalizedError instanceof Error
          ? { detail: normalizedError.message }
          : {}),
      requestId: response.locals.requestId,
    });
};
