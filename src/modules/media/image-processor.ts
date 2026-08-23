import { createHash } from 'node:crypto';

import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http/http-error.js';
import type { MediaExtension, MediaMimeType, ProcessedImage } from './media.types.js';

interface AllowedType {
  extension: MediaExtension;
  mimeType: MediaMimeType;
}

const allowedTypes = new Map<string, AllowedType>([
  ['image/jpeg', { extension: 'jpg', mimeType: 'image/jpeg' }],
  ['image/png', { extension: 'png', mimeType: 'image/png' }],
]);

function invalidImage(message: string): HttpError {
  return new HttpError(415, 'Image non prise en charge', message);
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const detectedType = await fileTypeFromBuffer(input);
  const allowedType = detectedType ? allowedTypes.get(detectedType.mime) : undefined;

  if (!allowedType) {
    throw invalidImage('Le contenu réel doit être une image JPEG ou PNG.');
  }

  try {
    const source = sharp(input, {
      failOn: 'error',
      limitInputPixels: env.MEDIA_MAX_INPUT_PIXELS,
      sequentialRead: true,
    }).rotate();

    const output =
      allowedType.extension === 'jpg'
        ? source.jpeg({ quality: 88, mozjpeg: true })
        : source.png({ compressionLevel: 9, adaptiveFiltering: true });
    const { data, info } = await output.toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height) {
      throw invalidImage("Les dimensions de l'image sont invalides.");
    }

    return {
      data,
      extension: allowedType.extension,
      mimeType: allowedType.mimeType,
      byteSize: data.length,
      width: info.width,
      height: info.height,
      sha256: createHash('sha256').update(data).digest('hex'),
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw invalidImage("L'image est corrompue, trop grande ou impossible à décoder.");
  }
}
