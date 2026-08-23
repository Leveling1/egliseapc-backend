import { postgres } from '../../infra/database/postgres.js';
import type {
  MediaExtension,
  MediaMimeType,
  MediaRecord,
  MediaRepository,
  MediaStatus,
  DeleteMediaMetadata,
  PendingMedia,
} from './media.types.js';

interface MediaRow {
  id: string;
  public_filename: string;
  display_name: string;
  storage_key: string;
  mime_type: MediaMimeType;
  extension: MediaExtension;
  byte_size: string;
  width: number;
  height: number;
  sha256: string;
  external_reference: string | null;
  status: MediaStatus;
  created_at: Date;
  deleted_at: Date | null;
  deleted_reference: string | null;
  deletion_reason: string | null;
}

const returnedColumns = `
  id, public_filename, display_name, storage_key, mime_type, extension, byte_size,
  width, height, sha256, external_reference, status, created_at,
  deleted_at, deleted_reference, deletion_reason
`;

function mapRow(row: MediaRow): MediaRecord {
  return {
    id: row.id,
    publicFilename: row.public_filename,
    displayName: row.display_name,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    extension: row.extension,
    byteSize: Number(row.byte_size),
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    externalReference: row.external_reference,
    status: row.status,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    deletedReference: row.deleted_reference,
    deletionReason: row.deletion_reason,
  };
}

export class PostgresMediaRepository implements MediaRepository {
  public async createPending(media: PendingMedia): Promise<MediaRecord> {
    const result = await postgres.query<MediaRow>(
      `INSERT INTO media_assets (
        id, public_filename, display_name, storage_key, mime_type, extension, byte_size,
        width, height, sha256, external_reference, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING ${returnedColumns}`,
      [
        media.id,
        media.publicFilename,
        media.displayName,
        media.storageKey,
        media.mimeType,
        media.extension,
        media.byteSize,
        media.width,
        media.height,
        media.sha256,
        media.externalReference,
        media.status,
      ],
    );

    const row = result.rows[0];
    if (!row) throw new Error("L'insertion du média n'a retourné aucune ligne.");
    return mapRow(row);
  }

  public async markReady(id: string): Promise<MediaRecord> {
    const result = await postgres.query<MediaRow>(
      `UPDATE media_assets SET status = 'ready' WHERE id = $1 AND status = 'pending'
       RETURNING ${returnedColumns}`,
      [id],
    );

    const row = result.rows[0];
    if (!row) throw new Error(`Le média ${id} ne peut pas être activé.`);
    return mapRow(row);
  }

  public async markFailed(id: string): Promise<void> {
    await postgres.query(
      "UPDATE media_assets SET status = 'failed' WHERE id = $1 AND status = 'pending'",
      [id],
    );
  }

  public async markDeleted(id: string, metadata: DeleteMediaMetadata): Promise<MediaRecord> {
    const result = await postgres.query<MediaRow>(
      `UPDATE media_assets
       SET status = 'deleted',
           deleted_at = NOW(),
           deleted_reference = $2,
           deletion_reason = $3
       WHERE id = $1 AND status = 'ready'
       RETURNING ${returnedColumns}`,
      [id, metadata.deletedReference ?? null, metadata.deletionReason ?? null],
    );

    const row = result.rows[0];
    if (!row) throw new Error(`Le média ${id} ne peut pas être supprimé.`);
    return mapRow(row);
  }

  public async findReadyById(id: string): Promise<MediaRecord | null> {
    const result = await postgres.query<MediaRow>(
      `SELECT ${returnedColumns} FROM media_assets
       WHERE id = $1 AND status = 'ready'`,
      [id],
    );

    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async findReadyByPublicFilename(publicFilename: string): Promise<MediaRecord | null> {
    const result = await postgres.query<MediaRow>(
      `SELECT ${returnedColumns} FROM media_assets
       WHERE public_filename = $1 AND status = 'ready'`,
      [publicFilename],
    );

    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }
}
