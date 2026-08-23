import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

export const requestContext: RequestHandler = (request, response, next) => {
  const incomingId = request.header('x-request-id');
  const requestId = incomingId && incomingId.length <= 128 ? incomingId : randomUUID();

  response.locals.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
};
