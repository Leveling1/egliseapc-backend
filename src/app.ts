import cors, { type CorsOptions } from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { allowedOrigins, env } from './config/env.js';
import { openApiDocument } from './config/openapi.js';
import { apiRouter } from './routes.js';
import { errorHandler, notFoundHandler } from './shared/http/error-handler.js';
import { HttpError } from './shared/http/http-error.js';
import { requestContext } from './shared/http/request-context.js';
import { logger } from './shared/logger.js';

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new HttpError(403, 'Origine interdite', "Cette origine n'est pas autorisée."));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['authorization', 'content-type', 'x-request-id'],
  maxAge: 600,
};

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      customProps: (_request, response) => ({
        requestId: response.getHeader('x-request-id'),
      }),
    }),
  );
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors(corsOptions));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 200,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb', parameterLimit: 100 }));

  if (env.SWAGGER_ENABLED) {
    app.use(
      '/docs',
      helmet.contentSecurityPolicy({
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      }),
      swaggerUi.serve,
      swaggerUi.setup(openApiDocument, { explorer: false }),
    );
  }

  app.use('/api/v1', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
