export type MediaExtension = 'jpg' | 'png';
export type MediaMimeType = 'image/jpeg' | 'image/png';
export type MediaStatus = 'pending' | 'ready' | 'failed' | 'deleted';

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
  deletedAt: Date | null;
  deletedReference: string | null;
  deletionReason: string | null;
}

export type PendingMedia = Omit<
  MediaRecord,
  'createdAt' | 'deletedAt' | 'deletedReference' | 'deletionReason'
>;

export interface DeleteMediaMetadata {
  deletedReference?: string;
  deletionReason?: string;
}

export interface MediaRepository {
  createPending(media: PendingMedia): Promise<MediaRecord>;
  markReady(id: string): Promise<MediaRecord>;
  markFailed(id: string): Promise<void>;
  markDeleted(id: string, metadata: DeleteMediaMetadata): Promise<MediaRecord>;
  findReadyById(id: string): Promise<MediaRecord | null>;
  findReadyByPublicFilename(publicFilename: string): Promise<MediaRecord | null>;
}

export interface MediaStorage {
  ensureReady(): Promise<void>;
  write(storageKey: string, data: Buffer): Promise<void>;
  read(storageKey: string): Promise<Buffer>;
  remove(storageKey: string): Promise<void>;
}
