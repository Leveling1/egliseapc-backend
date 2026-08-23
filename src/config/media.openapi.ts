export const mediaPaths = {
  '/api/v1/media': {
    post: {
      tags: ['Media'],
      summary: 'Téléverse une image JPEG ou PNG',
      description:
        "Endpoint service-à-service. Supabase doit vérifier l'utilisateur et son rôle avant l'appel.",
      operationId: 'uploadMedia',
      security: [{ IntegrationApiKey: [] }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['photo'],
              properties: {
                photo: {
                  type: 'string',
                  format: 'binary',
                  description: 'Une seule image JPEG ou PNG, 5 Mio par défaut.',
                },
                name: {
                  type: 'string',
                  maxLength: 120,
                  description: 'Nom lisible facultatif. Le serveur le normalise et le rend unique.',
                },
                externalReference: {
                  type: 'string',
                  maxLength: 128,
                  description: 'Référence opaque facultative fournie par Supabase pour audit.',
                },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Image validée, réencodée et conservée.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/MediaCreated' } },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '413': { $ref: '#/components/responses/PayloadTooLarge' },
        '415': { $ref: '#/components/responses/UnsupportedMediaType' },
        '429': { $ref: '#/components/responses/TooManyRequests' },
      },
    },
  },
  '/media/{filename}': {
    get: {
      tags: ['Media'],
      summary: 'Retourne une image publique en lecture seule',
      operationId: 'getPublicMedia',
      parameters: [
        {
          name: 'filename',
          in: 'path',
          required: true,
          schema: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*\\.(jpg|png)$' },
        },
      ],
      responses: {
        '200': {
          description: 'Contenu binaire de l’image.',
          headers: {
            ETag: { schema: { type: 'string' } },
            'Cache-Control': { schema: { type: 'string' } },
          },
          content: {
            'image/jpeg': { schema: { type: 'string', format: 'binary' } },
            'image/png': { schema: { type: 'string', format: 'binary' } },
          },
        },
        '304': { description: 'Le contenu en cache est encore valide.' },
        '404': { $ref: '#/components/responses/NotFound' },
      },
    },
  },
} as const;

export const mediaSchemas = {
  MediaCreated: {
    type: 'object',
    required: ['id', 'filename', 'url', 'mimeType', 'size', 'width', 'height', 'createdAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      filename: { type: 'string', example: 'photo-eglise-a1b2c3d4e5f60708.jpg' },
      url: { type: 'string', format: 'uri' },
      mimeType: { type: 'string', enum: ['image/jpeg', 'image/png'] },
      size: { type: 'integer', minimum: 1 },
      width: { type: 'integer', minimum: 1 },
      height: { type: 'integer', minimum: 1 },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
} as const;

export const mediaResponses = {
  BadRequest: { description: 'Requête multipart ou champs invalides.' },
  Unauthorized: { description: "Clé d'intégration absente ou invalide." },
  PayloadTooLarge: { description: 'Image au-dessus de la taille maximale.' },
  UnsupportedMediaType: { description: "Type déclaré ou contenu réel de l'image refusé." },
  TooManyRequests: { description: "Limite d'upload atteinte." },
  NotFound: { description: 'Image publique introuvable.' },
} as const;
