import sharp from 'sharp';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { MediaService } from '../src/modules/media/media.service.js';
import type {
  MediaRecord,
  MediaRepository,
  MediaStorage,
  PendingMedia,
} from '../src/modules/media/media.types.js';

class MemoryMediaRepository implements MediaRepository {
  public readonly records = new Map<string, MediaRecord>();

  public createPending(media: PendingMedia): Promise<MediaRecord> {
    const record = { ...media, createdAt: new Date('2026-01-01T00:00:00.000Z') };
    this.records.set(record.id, record);
    return Promise.resolve(record);
  }

  public markReady(id: string): Promise<MediaRecord> {
    const record = this.records.get(id);
    if (!record) throw new Error('Média absent');
    const ready = { ...record, status: 'ready' as const };
    this.records.set(id, ready);
    return Promise.resolve(ready);
  }

  public markFailed(id: string): Promise<void> {
    const record = this.records.get(id);
    if (record) this.records.set(id, { ...record, status: 'failed' });
    return Promise.resolve();
  }

  public findReadyByPublicFilename(filename: string): Promise<MediaRecord | null> {
    const record =
      [...this.records.values()].find(
        (record) => record.publicFilename === filename && record.status === 'ready',
      ) ?? null;
    return Promise.resolve(record);
  }
}

class MemoryMediaStorage implements MediaStorage {
  public readonly files = new Map<string, Buffer>();

  public ensureReady(): Promise<void> {
    return Promise.resolve();
  }

  public write(storageKey: string, data: Buffer): Promise<void> {
    if (this.files.has(storageKey)) throw new Error('Collision');
    this.files.set(storageKey, data);
    return Promise.resolve();
  }

  public read(storageKey: string): Promise<Buffer> {
    const data = this.files.get(storageKey);
    if (!data) throw new Error('Fichier absent');
    return Promise.resolve(data);
  }
}

interface MediaResponseBody {
  filename: string;
  url: string;
  mimeType: string;
}

const apiKeyHeader = { 'X-API-Key': env.INTEGRATION_API_KEY };

describe('API média externe', () => {
  let repository: MemoryMediaRepository;
  let storage: MemoryMediaStorage;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    repository = new MemoryMediaRepository();
    storage = new MemoryMediaStorage();
    app = createApp({ mediaService: new MediaService(repository, storage) });
  });

  it('refuse un upload sans clé avant de conserver le fichier', async () => {
    const jpeg = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
    })
      .jpeg()
      .toBuffer();
    const response = await request(app)
      .post('/api/v1/media')
      .attach('photo', jpeg, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ title: 'Client non autorisé' });
    expect(storage.files.size).toBe(0);

    const wrongKey = await request(app)
      .post('/api/v1/media')
      .set('X-API-Key', 'wrong-key-that-is-at-least-32-characters')
      .attach('photo', jpeg, { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(wrongKey.status).toBe(401);
    expect(storage.files.size).toBe(0);
  });

  it('réencode un JPEG et retourne une URL publique lisible', async () => {
    const jpeg = await sharp({
      create: { width: 3, height: 2, channels: 3, background: '#ff0000' },
    })
      .jpeg()
      .withMetadata({ orientation: 1 })
      .toBuffer();
    const response = await request(app)
      .post('/api/v1/media')
      .set(apiKeyHeader)
      .field('name', 'Photo de l’Église 2026.jpg')
      .field('externalReference', 'supabase-user-or-operation-id')
      .attach('photo', jpeg, { filename: '../../danger.jpg', contentType: 'image/jpeg' });
    const body = response.body as unknown as MediaResponseBody;

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      mimeType: 'image/jpeg',
      width: 3,
      height: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(body.filename).toMatch(/^photo-de-l-eglise-2026-[a-f0-9]{16}\.jpg$/);
    expect(body.url).toBe(`${env.MEDIA_PUBLIC_BASE_URL}/${body.filename}`);
    expect(storage.files.size).toBe(1);

    const publicResponse = await request(app).get(`/media/${body.filename}`);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.type).toBe('image/jpeg');
    expect(publicResponse.headers['cache-control']).toContain('immutable');
    expect(publicResponse.headers.etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(publicResponse.headers['access-control-allow-origin']).toBe('*');
    expect(publicResponse.headers['cross-origin-resource-policy']).toBe('cross-origin');
    const etag = publicResponse.headers.etag;
    if (typeof etag !== 'string') throw new Error('ETag absent');

    const cachedResponse = await request(app)
      .get(`/media/${body.filename}`)
      .set('If-None-Match', etag);
    expect(cachedResponse.status).toBe(304);
  });

  it('déduit PNG du contenu et non du nom fourni', async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 4, background: '#0000ff' },
    })
      .png()
      .toBuffer();
    const response = await request(app)
      .post('/api/v1/media')
      .set(apiKeyHeader)
      .field('name', 'logo.jpg')
      .attach('photo', png, { filename: 'faux.jpg', contentType: 'image/png' });
    const body = response.body as unknown as MediaResponseBody;

    expect(response.status).toBe(201);
    expect(body.filename).toMatch(/^logo-[a-f0-9]{16}\.png$/);
    expect(body.mimeType).toBe('image/png');
  });

  it('refuse un contenu falsifié malgré un MIME JPEG', async () => {
    const response = await request(app)
      .post('/api/v1/media')
      .set(apiKeyHeader)
      .attach('photo', Buffer.from('not-a-real-image'), {
        filename: 'attaque.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(415);
    expect(response.body).toMatchObject({ title: 'Image non prise en charge' });
  });

  it('refuse un type déclaré hors de la liste blanche', async () => {
    const response = await request(app)
      .post('/api/v1/media')
      .set(apiKeyHeader)
      .attach('photo', Buffer.from('<svg/>'), {
        filename: 'image.svg',
        contentType: 'image/svg+xml',
      });

    expect(response.status).toBe(415);
    expect(response.body).toMatchObject({ title: 'Type déclaré non pris en charge' });
  });

  it('refuse un fichier dépassant la limite configurée', async () => {
    const response = await request(app)
      .post('/api/v1/media')
      .set(apiKeyHeader)
      .attach('photo', Buffer.alloc(env.MEDIA_MAX_FILE_SIZE_BYTES + 1), {
        filename: 'large.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({ title: 'Fichier trop volumineux' });
  });

  it('n’expose aucune suppression et masque les chemins invalides', async () => {
    const [apiDelete, publicDelete, traversal] = await Promise.all([
      request(app).delete('/api/v1/media/example.jpg').set(apiKeyHeader),
      request(app).delete('/media/example.jpg'),
      request(app).get('/media/not-a-valid-file.exe'),
    ]);

    expect(apiDelete.status).toBe(404);
    expect(publicDelete.status).toBe(404);
    expect(traversal.status).toBe(404);
  });
});
