import { LocalMediaStorage } from './local-media-storage.js';
import { PostgresMediaRepository } from './media.repository.js';
import { MediaService } from './media.service.js';

export const localMediaStorage = new LocalMediaStorage();
export const mediaService = new MediaService(new PostgresMediaRepository(), localMediaStorage);
