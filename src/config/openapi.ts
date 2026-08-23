export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Eglise APC Media API',
    version: '0.1.0',
    description: 'API sécurisée de stockage et de consultation de médias.',
  },
  servers: [{ url: '/api/v1', description: 'Version 1' }],
  tags: [{ name: 'Health', description: "État de santé de l'application" }],
  paths: {
    '/health/live': {
      get: {
        tags: ['Health'],
        summary: "Vérifie que le processus de l'API répond",
        operationId: 'getLiveness',
        responses: {
          '200': {
            description: 'Le processus répond.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Liveness' },
              },
            },
          },
        },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        summary: 'Vérifie les connexions PostgreSQL et Redis',
        operationId: 'getReadiness',
        responses: {
          '200': { description: 'Toutes les dépendances sont prêtes.' },
          '503': { description: 'Au moins une dépendance est indisponible.' },
        },
      },
    },
  },
  components: {
    schemas: {
      Liveness: {
        type: 'object',
        required: ['status', 'timestamp'],
        properties: {
          status: { type: 'string', const: 'ok' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      Problem: {
        type: 'object',
        required: ['type', 'title', 'status', 'requestId'],
        properties: {
          type: { type: 'string', format: 'uri-reference' },
          title: { type: 'string' },
          status: { type: 'integer' },
          detail: { type: 'string' },
          requestId: { type: 'string', format: 'uuid' },
        },
      },
    },
  },
} as const;
