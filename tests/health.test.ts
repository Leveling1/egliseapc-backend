import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('GET /api/v1/health/live', () => {
  it('retourne un statut de disponibilité', async () => {
    const response = await request(createApp()).get('/api/v1/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeTypeOf('string');
  });
});

describe('route inconnue', () => {
  it('retourne une réponse problem+json sans signature Express', async () => {
    const response = await request(createApp()).get('/inconnue');

    expect(response.status).toBe(404);
    expect(response.type).toBe('application/problem+json');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

describe('politique CORS', () => {
  it('refuse une origine absente de la liste blanche', async () => {
    const response = await request(createApp())
      .get('/api/v1/health/live')
      .set('Origin', 'https://evil.example');

    expect(response.status).toBe(403);
    expect(response.type).toBe('application/problem+json');
    expect(response.body).toMatchObject({ title: 'Origine interdite', status: 403 });
  });
});
