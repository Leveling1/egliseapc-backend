import { constants } from 'node:fs';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';

import { env } from '../../config/env.js';
import type { MediaStorage } from './media.types.js';

const safeStorageKeyPattern = /^[a-z0-9][a-z0-9-]{0,119}\.(?:jpg|png)$/;

export class LocalMediaStorage implements MediaStorage {
  private readonly root = resolve(env.MEDIA_STORAGE_PATH);

  private resolveKey(storageKey: string): string {
    if (!safeStorageKeyPattern.test(storageKey)) {
      throw new Error('Clé de stockage invalide.');
    }

    const path = resolve(this.root, storageKey);
    if (isAbsolute(storageKey) || !path.startsWith(`${this.root}${sep}`)) {
      throw new Error('La clé de stockage sort du répertoire autorisé.');
    }
    return path;
  }

  public async ensureReady(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o750 });
    await access(this.root, constants.R_OK | constants.W_OK);
  }

  public async write(storageKey: string, data: Buffer): Promise<void> {
    await writeFile(this.resolveKey(storageKey), data, { flag: 'wx', mode: 0o640 });
  }

  public async read(storageKey: string): Promise<Buffer> {
    return readFile(this.resolveKey(storageKey));
  }

  public async remove(storageKey: string): Promise<void> {
    await rm(this.resolveKey(storageKey), { force: true });
  }
}
