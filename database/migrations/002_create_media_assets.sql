CREATE TABLE media_assets (
  id UUID PRIMARY KEY,
  public_filename TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png')),
  extension TEXT NOT NULL CHECK (extension IN ('jpg', 'png')),
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  sha256 CHAR(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  external_reference TEXT CHECK (
    external_reference IS NULL OR char_length(external_reference) BETWEEN 1 AND 128
  ),
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (public_filename ~ '^[a-z0-9][a-z0-9-]{0,119}\.(jpg|png)$'),
  CHECK (storage_key = public_filename),
  CHECK (
    (mime_type = 'image/jpeg' AND extension = 'jpg') OR
    (mime_type = 'image/png' AND extension = 'png')
  )
);

CREATE INDEX media_assets_sha256_idx ON media_assets (sha256);
CREATE INDEX media_assets_created_at_idx ON media_assets (created_at DESC);

CREATE FUNCTION prevent_media_asset_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La suppression des médias est interdite';
END;
$$;

CREATE TRIGGER media_assets_no_delete
BEFORE DELETE ON media_assets
FOR EACH ROW EXECUTE FUNCTION prevent_media_asset_delete();

CREATE FUNCTION restrict_media_asset_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'pending' OR NEW.status NOT IN ('ready', 'failed') THEN
    RAISE EXCEPTION 'Transition de statut média interdite';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.public_filename IS DISTINCT FROM OLD.public_filename
    OR NEW.display_name IS DISTINCT FROM OLD.display_name
    OR NEW.storage_key IS DISTINCT FROM OLD.storage_key
    OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
    OR NEW.extension IS DISTINCT FROM OLD.extension
    OR NEW.byte_size IS DISTINCT FROM OLD.byte_size
    OR NEW.width IS DISTINCT FROM OLD.width
    OR NEW.height IS DISTINCT FROM OLD.height
    OR NEW.sha256 IS DISTINCT FROM OLD.sha256
    OR NEW.external_reference IS DISTINCT FROM OLD.external_reference
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Les métadonnées média sont immuables';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER media_assets_restrict_update
BEFORE UPDATE ON media_assets
FOR EACH ROW EXECUTE FUNCTION restrict_media_asset_update();

REVOKE DELETE ON media_assets FROM PUBLIC;
