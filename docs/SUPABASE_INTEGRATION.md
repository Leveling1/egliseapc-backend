# Intégrer le service média à Supabase

Ce document décrit l’intégration où Supabase est le client de cette API externe. Supabase connaît
les utilisateurs, valide leur session et décide de leurs permissions. L’API média ne reçoit qu’une
requête déjà autorisée et authentifie Supabase avec une clé technique dédiée.

## 1. Flux complet

```text
Client → Supabase Auth → Edge Function → API média → PostgreSQL + volume média
                                      ← URL publique ←
```

1. Le client appelle une Edge Function avec son JWT Supabase.
2. Supabase valide la session et le rôle selon les règles déjà en place.
3. L’Edge Function appelle `POST /api/v1/media` avec `X-API-Key`.
4. L’API vérifie cette clé avant de lire le multipart.
5. L’image est limitée, détectée par magic bytes, décodée puis réencodée.
6. L’API répond avec une URL comme `https://api.example.com/media/culte-a1b2c3d4.jpg`.

L’API média ne contient aucune table utilisateur et ne valide aucun rôle Supabase.

## 2. Créer la clé d’intégration

Générer 32 octets aléatoires, encodés en hexadécimal :

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

La valeur obtenue doit être copiée à deux endroits seulement.

Dans le `.env` privé du serveur Express :

```env
INTEGRATION_API_KEY=valeur-generee
```

Dans les secrets Supabase :

```bash
supabase secrets set MEDIA_API_URL=https://api.example.com
supabase secrets set MEDIA_API_KEY=valeur-generee
```

`MEDIA_API_KEY` et `INTEGRATION_API_KEY` ont des noms différents, mais la même valeur. Ne jamais
mettre cette valeur dans le frontend, le dépôt Git, Swagger public ou les logs.

## 3. Créer l’Edge Function

```bash
supabase functions new upload-photo
```

Exemple de `supabase/functions/upload-photo/index.ts` :

```ts
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return new Response('Unauthorized', { status: 401 });

  // Brancher ici le contrôle de rôle déjà utilisé par votre backend Supabase.
  const allowed = data.user.app_metadata?.permissions?.includes('media:upload');
  if (!allowed) return new Response('Forbidden', { status: 403 });

  const formData = await request.formData();
  formData.set('externalReference', data.user.id);

  const mediaResponse = await fetch(`${Deno.env.get('MEDIA_API_URL')}/api/v1/media`, {
    method: 'POST',
    headers: { 'X-API-Key': Deno.env.get('MEDIA_API_KEY')! },
    body: formData,
  });

  return new Response(await mediaResponse.arrayBuffer(), {
    status: mediaResponse.status,
    headers: { 'Content-Type': mediaResponse.headers.get('Content-Type') ?? 'application/json' },
  });
});
```

Le contrôle `permissions.includes(...)` est un exemple. Remplacez-le par la fonction ou la règle
d’autorisation déjà utilisée dans votre projet Supabase.

## 4. Activer la vérification Supabase

Conserver la vérification JWT pour cette fonction dans `supabase/config.toml` :

```toml
[functions.upload-photo]
verify_jwt = true
```

Déployer ensuite :

```bash
supabase functions deploy upload-photo
```

Le frontend appelle uniquement cette Edge Function. Il ne reçoit jamais `MEDIA_API_KEY`.

## 5. Requête frontend

```ts
const formData = new FormData();
formData.append('photo', file);
formData.append('name', 'Photo du culte');

const { data, error } = await supabase.functions.invoke('upload-photo', {
  body: formData,
});
```

Réponse réussie :

```json
{
  "id": "2dbdbe5b-df3b-4a91-84c8-9d1d1158b11d",
  "filename": "photo-du-culte-a1b2c3d4e5f60708.jpg",
  "url": "https://api.example.com/media/photo-du-culte-a1b2c3d4e5f60708.jpg",
  "mimeType": "image/jpeg",
  "size": 241903,
  "width": 1600,
  "height": 900,
  "createdAt": "2026-08-23T12:00:00.000Z"
}
```

## 6. Tester sans Supabase

Ce test vérifie uniquement le contrat service-à-service :

```bash
curl -X POST http://localhost:3000/api/v1/media \
  -H "X-API-Key: VOTRE_CLE" \
  -F "photo=@./photo.jpg;type=image/jpeg" \
  -F "name=Photo du culte" \
  -F "externalReference=test-local"
```

Sans clé ou avec une mauvaise clé, la réponse est `401`. Un faux JPEG ou PNG produit `415`, un
fichier trop volumineux `413` et une limite de débit atteinte `429`.

## 7. Rotation de la clé

1. Générer une nouvelle clé.
2. Mettre à jour `MEDIA_API_KEY` dans Supabase.
3. Mettre à jour `INTEGRATION_API_KEY` sur le serveur Express.
4. Redéployer/redémarrer dans une fenêtre de maintenance courte.
5. Vérifier un upload puis considérer l’ancienne clé comme révoquée.

Une évolution future pourra accepter temporairement deux clés pour une rotation sans interruption.

## 8. Mise en production

- Placer Express derrière HTTPS et un reverse proxy.
- Ne publier que le port du reverse proxy.
- Configurer `MEDIA_PUBLIC_BASE_URL` avec le domaine HTTPS réel.
- Sauvegarder PostgreSQL et le volume `media-data` ensemble.
- Restreindre `POST /api/v1/media` au niveau du pare-feu si les IP de sortie sont stables.
- Garder `GET /media/:filename` public uniquement si les images sont réellement publiques.
- Mettre `SWAGGER_ENABLED=false` si Swagger ne doit pas être accessible publiquement.

Le header `X-API-Key` protège l’identité technique de Supabase. HTTPS protège la clé pendant le
transport. Les deux sont nécessaires.
