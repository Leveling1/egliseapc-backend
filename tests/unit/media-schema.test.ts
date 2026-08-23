import { describe, expect, it } from 'vitest';

import {
  createSafeDisplayName,
  isSafePublicFilename,
} from '../../src/modules/media/media.schema.js';

describe('media schema helpers', () => {
  it('normalise un nom lisible sans garder le chemin ni l’extension', () => {
    expect(createSafeDisplayName('../../Photo de l’Église 2026.JPG')).toBe(
      'photo-de-l-eglise-2026',
    );
    expect(createSafeDisplayName('***')).toBe('photo');
  });

  it('accepte uniquement les noms publics générés par le service', () => {
    expect(isSafePublicFilename('photo-du-culte-a1b2c3d4e5f60708.jpg')).toBe(true);
    expect(isSafePublicFilename('logo-a1b2c3d4e5f60708.png')).toBe(true);
    expect(isSafePublicFilename('../secret.jpg')).toBe(false);
    expect(isSafePublicFilename('script.svg')).toBe(false);
  });
});
