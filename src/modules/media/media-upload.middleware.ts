import type { RequestHandler } from 'express';
import multer from 'multer';

import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http/http-error.js';

const acceptedDeclaredMimeTypes = new Set(['image/jpeg', 'image/png']);

const receiveSinglePhoto = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MEDIA_MAX_FILE_SIZE_BYTES,
    files: 1,
    fields: 2,
    parts: 4,
    fieldSize: 1_024,
  },
  fileFilter: (_request, file, callback) => {
    if (!acceptedDeclaredMimeTypes.has(file.mimetype)) {
      callback(
        new HttpError(
          415,
          'Type déclaré non pris en charge',
          'Le Content-Type du fichier doit être image/jpeg ou image/png.',
        ),
      );
      return;
    }
    callback(null, true);
  },
}).single('photo');

export const mediaUploadMiddleware: RequestHandler = (request, response, next) => {
  receiveSinglePhoto(request, response, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(
          new HttpError(
            413,
            'Fichier trop volumineux',
            `La taille maximale est de ${String(env.MEDIA_MAX_FILE_SIZE_BYTES)} octets.`,
          ),
        );
        return;
      }
      next(new HttpError(400, "Requête d'upload invalide", `Erreur multipart : ${error.code}.`));
      return;
    }

    next(error);
  });
};
