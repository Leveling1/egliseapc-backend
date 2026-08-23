import pino from 'pino';

import { env } from '../config/env.js';

const developmentTransport = {
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, singleLine: true, translateTime: 'SYS:standard' },
  },
};

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      'token',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  ...(env.NODE_ENV === 'development' ? developmentTransport : {}),
});
