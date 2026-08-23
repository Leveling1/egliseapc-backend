import { mediaPaths, mediaResponses, mediaSchemas } from './media.openapi.js';

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Eglise APC Media API',
    version: '1.0.0',
    description:
      'Service média externe consommé par Supabase. Les écritures exigent une clé d’intégration.',
  },
  servers: [{ url: '/', description: 'Serveur courant' }],
  tags: [
    { name: 'Health', description: "État de santé de l'application" },
    { name: 'Media', description: 'Upload privé et consultation publique des images' },
  ],
  paths: {
    '/api/v1/health/live': {
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
    '/api/v1/health/ready': {
      get: {
        tags: ['Health'],
        summary: 'Vérifie PostgreSQL, Redis et le stockage média',
        operationId: 'getReadiness',
        responses: {
          '200': { description: 'Toutes les dépendances sont prêtes.' },
          '503': { description: 'Au moins une dépendance est indisponible.' },
        },
      },
    },
    ...mediaPaths,
  },
  components: {
    securitySchemes: {
      IntegrationApiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Secret serveur-à-serveur configuré dans Supabase et dans cette API.',
      },
    },
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
      ...mediaSchemas,
    },
    responses: mediaResponses,
  },
} as const;
