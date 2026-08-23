export type MediaExtension = 'jpg' | 'png';
export type MediaMimeType = 'image/jpeg' | 'image/png';
export type MediaStatus = 'pending' | 'ready' | 'failed';

export interface ProcessedImage {
  data: Buffer;
  extension: MediaExtension;
  mimeType: MediaMimeType;
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
}

export interface MediaRecord {
  id: string;
  publicFilename: string;
  displayName: string;
  storageKey: string;
  mimeType: MediaMimeType;
  extension: MediaExtension;
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
  externalReference: string | null;
  status: MediaStatus;
  createdAt: Date;
}

export type PendingMedia = Omit<MediaRecord, 'createdAt'>;

export interface MediaRepository {
  createPending(media: PendingMedia): Promise<MediaRecord>;
  markReady(id: string): Promise<MediaRecord>;
  markFailed(id: string): Promise<void>;
  findReadyByPublicFilename(publicFilename: string): Promise<MediaRecord | null>;
}

export interface MediaStorage {
  ensureReady(): Promise<void>;
  write(storageKey: string, data: Buffer): Promise<void>;
  read(storageKey: string): Promise<Buffer>;
}
