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
            encoding: {
              photo: {
                contentType: 'image/jpeg, image/png',
              },
            },
            examples: {
              uploadJpeg: {
                summary: 'Upload JPEG via form-data',
                value: {
                  photo: '<fichier-binaire-jpeg>',
                  name: 'Photo du culte',
                  externalReference: 'supabase-user-or-operation-id',
                },
              },
              uploadPng: {
                summary: 'Upload PNG via form-data',
                value: {
                  photo: '<fichier-binaire-png>',
                  name: 'Logo APC',
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
            'application/json': {
              schema: { $ref: '#/components/schemas/MediaCreated' },
              examples: {
                uploadedImage: {
                  summary: 'Réponse JSON retournée à Supabase',
                  value: {
                    id: '2dbdbe5b-df3b-4a91-84c8-9d1d1158b11d',
                    filename: 'photo-du-culte-a1b2c3d4e5f60708.jpg',
                    url: 'https://api.example.com/media/photo-du-culte-a1b2c3d4e5f60708.jpg',
                    mimeType: 'image/jpeg',
                    size: 241903,
                    width: 1600,
                    height: 900,
                    createdAt: '2026-08-23T12:00:00.000Z',
                  },
                },
              },
            },
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
  '/api/v1/media/{id}': {
    delete: {
      tags: ['Media'],
      summary: 'Supprime une image sur décision de Supabase',
      description:
        "Endpoint service-à-service. Supabase doit vérifier l'utilisateur et son rôle avant l'appel.",
      operationId: 'deleteMedia',
      security: [{ IntegrationApiKey: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/MediaDeleteRequest' },
            examples: {
              deletedBySupabase: {
                summary: 'Audit fourni par Supabase',
                value: {
                  deletedReference: 'supabase-user-or-operation-id',
                  reason: 'removed_by_admin',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Image dépubliée et fichier retiré du volume si possible.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MediaDeleted' },
              examples: {
                deletedImage: {
                  value: {
                    id: '2dbdbe5b-df3b-4a91-84c8-9d1d1158b11d',
                    filename: 'photo-du-culte-a1b2c3d4e5f60708.jpg',
                    status: 'deleted',
                    deletedAt: '2026-08-23T12:10:00.000Z',
                  },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
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

const problemContent = {
  'application/problem+json': {
    schema: { $ref: '#/components/schemas/Problem' },
    examples: {
      problem: {
        value: {
          type: 'about:blank',
          title: 'Requête invalide',
          status: 400,
          detail: 'Le détail dépend du contrôle échoué.',
          requestId: '2dbdbe5b-df3b-4a91-84c8-9d1d1158b11d',
        },
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
  MediaDeleteRequest: {
    type: 'object',
    additionalProperties: false,
    properties: {
      deletedReference: {
        type: 'string',
        maxLength: 128,
        description: 'Référence opaque fournie par Supabase pour audit.',
      },
      reason: {
        type: 'string',
        maxLength: 200,
        description: 'Raison technique ou métier de la suppression.',
      },
    },
  },
  MediaDeleted: {
    type: 'object',
    required: ['id', 'filename', 'status', 'deletedAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      filename: { type: 'string', example: 'photo-du-culte-a1b2c3d4e5f60708.jpg' },
      status: { type: 'string', const: 'deleted' },
      deletedAt: { type: 'string', format: 'date-time' },
    },
  },
} as const;

export const mediaResponses = {
  BadRequest: { description: 'Requête multipart ou champs invalides.', content: problemContent },
  Unauthorized: { description: "Clé d'intégration absente ou invalide.", content: problemContent },
  PayloadTooLarge: {
    description: 'Image au-dessus de la taille maximale.',
    content: problemContent,
  },
  UnsupportedMediaType: {
    description: "Type déclaré ou contenu réel de l'image refusé.",
    content: problemContent,
  },
  TooManyRequests: { description: "Limite d'upload atteinte.", content: problemContent },
  NotFound: { description: 'Image publique introuvable.', content: problemContent },
} as const;
