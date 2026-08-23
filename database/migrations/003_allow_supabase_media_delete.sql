ALTER TABLE media_assets
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_reference TEXT CHECK (
    deleted_reference IS NULL OR char_length(deleted_reference) BETWEEN 1 AND 128
  ),
  ADD COLUMN deletion_reason TEXT CHECK (
    deletion_reason IS NULL OR char_length(deletion_reason) BETWEEN 1 AND 200
  );

ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_status_check;
ALTER TABLE media_assets
  ADD CONSTRAINT media_assets_status_check CHECK (status IN ('pending', 'ready', 'failed', 'deleted'));

ALTER TABLE media_assets
  ADD CONSTRAINT media_assets_deleted_state_check CHECK (
    (
      status = 'deleted'
      AND deleted_at IS NOT NULL
    )
    OR (
      status <> 'deleted'
      AND deleted_at IS NULL
      AND deleted_reference IS NULL
      AND deletion_reason IS NULL
    )
  );

DROP TRIGGER media_assets_restrict_update ON media_assets;
DROP FUNCTION restrict_media_asset_update();

CREATE FUNCTION restrict_media_asset_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('ready', 'failed') THEN
    IF NEW.deleted_at IS NOT NULL
      OR NEW.deleted_reference IS NOT NULL
      OR NEW.deletion_reason IS NOT NULL THEN
      RAISE EXCEPTION 'Métadonnées de suppression interdites sur cette transition média';
    END IF;
  ELSIF OLD.status = 'ready' AND NEW.status = 'deleted' THEN
    IF NEW.deleted_at IS NULL THEN
      RAISE EXCEPTION 'Date de suppression média obligatoire';
    END IF;
  ELSE
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

CREATE INDEX media_assets_deleted_at_idx ON media_assets (deleted_at DESC)
WHERE status = 'deleted';
