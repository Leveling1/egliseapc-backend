import type { RequestHandler } from 'express';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http/http-error.js';
import {
  mediaDeleteBodySchema,
  mediaIdParamSchema,
  mediaUploadFieldsSchema,
} from './media.schema.js';
import type { MediaService } from './media.service.js';

export function createUploadMediaHandler(service: MediaService): RequestHandler {
  return async (request, response) => {
    if (!request.file) {
      throw new HttpError(400, 'Fichier manquant', 'Le champ multipart « photo » est obligatoire.');
    }

    const parsedFields = mediaUploadFieldsSchema.safeParse(request.body);
    if (!parsedFields.success) {
      throw new HttpError(400, 'Champs invalides', z.prettifyError(parsedFields.error));
    }

    const record = await service.upload({
      data: request.file.buffer,
      originalFilename: request.file.originalname,
      ...(parsedFields.data.name ? { preferredName: parsedFields.data.name } : {}),
      ...(parsedFields.data.externalReference
        ? { externalReference: parsedFields.data.externalReference }
        : {}),
    });

    response.status(201).json({
      id: record.id,
      filename: record.publicFilename,
      url: service.buildPublicUrl(record.publicFilename),
      mimeType: record.mimeType,
      size: record.byteSize,
      width: record.width,
      height: record.height,
      createdAt: record.createdAt.toISOString(),
    });
  };
}

export function createGetPublicMediaHandler(service: MediaService): RequestHandler {
  return async (request, response) => {
    const filename = request.params.filename;
    if (typeof filename !== 'string') {
      throw new HttpError(404, 'Image introuvable', "Cette image n'existe pas.");
    }

    const { record, data } = await service.getPublicMedia(filename);
    const etag = `"${record.sha256}"`;

    response.set({
      'Cache-Control': `public, max-age=${String(env.MEDIA_PUBLIC_CACHE_SECONDS)}, immutable`,
      'Content-Disposition': `inline; filename="${record.publicFilename}"`,
      'Cross-Origin-Resource-Policy': 'cross-origin',
      ETag: etag,
    });

    if (request.get('if-none-match') === etag) {
      response.status(304).end();
      return;
    }

    response.status(200).type(record.mimeType).send(data);
  };
}

export function createDeleteMediaHandler(service: MediaService): RequestHandler {
  return async (request, response) => {
    const parsedId = mediaIdParamSchema.safeParse(request.params.id);
    if (!parsedId.success) {
      throw new HttpError(404, 'Image introuvable', "Cette image n'existe pas.");
    }

    const parsedBody = mediaDeleteBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new HttpError(400, 'Corps JSON invalide', z.prettifyError(parsedBody.error));
    }

    const record = await service.deleteMedia(parsedId.data, {
      ...(parsedBody.data.deletedReference
        ? { deletedReference: parsedBody.data.deletedReference }
        : {}),
      ...(parsedBody.data.reason ? { reason: parsedBody.data.reason } : {}),
    });

    response.status(200).json({
      id: record.id,
      filename: record.publicFilename,
      status: record.status,
      deletedAt: record.deletedAt?.toISOString() ?? null,
    });
  };
}
