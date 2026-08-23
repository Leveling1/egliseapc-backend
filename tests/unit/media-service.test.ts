import { describe, expect, it } from 'vitest';

import { env } from '../../src/config/env.js';
import { MediaService } from '../../src/modules/media/media.service.js';
import type {
  MediaRecord,
  MediaRepository,
  MediaStorage,
  DeleteMediaMetadata,
  PendingMedia,
} from '../../src/modules/media/media.types.js';

class UnitMediaRepository implements MediaRepository {
  public createPending(media: PendingMedia): Promise<MediaRecord> {
    return Promise.resolve({
      ...media,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null,
      deletedReference: null,
      deletionReason: null,
    });
  }

  public markReady(): Promise<MediaRecord> {
    throw new Error('Non utilisé dans ce test');
  }

  public markFailed(): Promise<void> {
    throw new Error('Non utilisé dans ce test');
  }

  public markDeleted(_id: string, _metadata: DeleteMediaMetadata): Promise<MediaRecord> {
    throw new Error('Non utilisé dans ce test');
  }

  public findReadyById(): Promise<MediaRecord | null> {
    return Promise.resolve(null);
  }

  public findReadyByPublicFilename(): Promise<MediaRecord | null> {
    return Promise.resolve(null);
  }
}

class UnitMediaStorage implements MediaStorage {
  public ensureReady(): Promise<void> {
    return Promise.resolve();
  }

  public write(): Promise<void> {
    return Promise.resolve();
  }

  public read(): Promise<Buffer> {
    return Promise.resolve(Buffer.alloc(0));
  }

  public remove(): Promise<void> {
    return Promise.resolve();
  }
}

describe('MediaService', () => {
  it('construit une URL publique absolue depuis la configuration', () => {
    const service = new MediaService(new UnitMediaRepository(), new UnitMediaStorage());

    expect(service.buildPublicUrl('photo-du-culte-a1b2c3d4e5f60708.jpg')).toBe(
      `${env.MEDIA_PUBLIC_BASE_URL}/photo-du-culte-a1b2c3d4e5f60708.jpg`,
    );
  });
});
