import { basename } from 'node:path';

import { z } from 'zod';

export const mediaUploadFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  externalReference: z.string().trim().min(1).max(128).optional(),
});

export function createSafeDisplayName(value: string): string {
  const filename = basename(value.replaceAll('\\', '/')).replace(/\.[^.]+$/, '');
  const slug = filename
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');

  return slug || 'photo';
}

export function isSafePublicFilename(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,119}\.(?:jpg|png)$/.test(value);
}
