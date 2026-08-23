# Intégration du service média externe

Ce document est destiné au backend Supabase qui consomme l'API média comme un service externe.
Supabase reste responsable des utilisateurs, des rôles et des décisions métier. Cette API ne gère
que la validation, le stockage et la publication d'images JPEG/PNG.

## 1. Responsabilités

```text
Client
  -> Supabase Auth + Edge Function
  -> API média Express
  -> PostgreSQL + volume média
  <- JSON avec URL publique
```

Supabase doit vérifier :

- le JWT de l'utilisateur ;
- le rôle ou la permission ;
- le fait que l'action d'upload est autorisée ;
- la conservation de l'URL retournée dans ses propres tables.

L'API média vérifie uniquement :

- que l'appel vient d'un client technique autorisé avec `X-API-Key` ;
- que le fichier est une vraie image JPEG ou PNG ;
- que le fichier est réencodé avant stockage ;
- que l'URL publique retournée pointe vers l'image conservée.

## 2. Secrets à configurer

Générer une clé privée longue :

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Sur le serveur Express, dans `.env` :

```env
INTEGRATION_API_KEY=<même-valeur-que-media-api-key>
MEDIA_PUBLIC_BASE_URL=https://api.example.com/media
```

Dans Supabase :

```bash
supabase secrets set MEDIA_API_URL=https://api.example.com
supabase secrets set MEDIA_API_KEY=<même-valeur-que-integration-api-key>
```

`SUPABASE_ANON_KEY` n'est pas utilisée par Express. Elle peut servir dans l'Edge Function pour
vérifier l'utilisateur Supabase, mais elle ne doit pas protéger l'appel vers l'API média. Le secret
serveur-à-serveur est `MEDIA_API_KEY` côté Supabase et `INTEGRATION_API_KEY` côté Express.

## 3. Upload depuis Supabase

Endpoint appelé par l'Edge Function :

```http
POST /api/v1/media
X-API-Key: <MEDIA_API_KEY>
Content-Type: multipart/form-data
```

Champs form-data :

| Champ               | Requis | Description                                                              |
| ------------------- | ------ | ------------------------------------------------------------------------ |
| `photo`             | oui    | Fichier JPEG ou PNG. Un seul fichier par requête.                        |
| `name`              | non    | Nom lisible souhaité. Le serveur le nettoie et ajoute un suffixe unique. |
| `externalReference` | non    | Référence opaque Supabase, par exemple id utilisateur ou opération.      |

Réponse `201 application/json` :

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

Supabase doit stocker au minimum `url` et peut aussi stocker `id`, `filename`, `mimeType`, `width`,
`height` et `size` si l'application en a besoin.

## 4. Exemple Edge Function

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
    headers: {
      'Content-Type': mediaResponse.headers.get('Content-Type') ?? 'application/json',
    },
  });
});
```

Le contrôle `permissions.includes('media:upload')` est un exemple. Utiliser la règle de rôle déjà
présente dans le projet Supabase.

## 5. Lecture publique

L'URL retournée dans `url` est directement exploitable dans un navigateur ou dans une balise image :

```text
https://api.example.com/media/photo-du-culte-a1b2c3d4e5f60708.jpg
```

`GET /media/:filename` est public. Une URL publique n'est donc pas un secret : toute personne qui la
possède peut voir l'image.

## 6. Suppression

Supabase peut supprimer une image après avoir autorisé l'utilisateur côté Supabase.

```http
DELETE /api/v1/media/{id}
X-API-Key: <MEDIA_API_KEY>
Content-Type: application/json
```

Corps JSON facultatif :

```json
{
  "deletedReference": "supabase-user-or-operation-id",
  "reason": "removed_by_admin"
}
```

Réponse `200 application/json` :

```json
{
  "id": "2dbdbe5b-df3b-4a91-84c8-9d1d1158b11d",
  "filename": "photo-du-culte-a1b2c3d4e5f60708.jpg",
  "status": "deleted",
  "deletedAt": "2026-08-23T12:10:00.000Z"
}
```

Après suppression, `GET /media/:filename` retourne `404`.

Important :

- Supabase décide qui a le droit de supprimer.
- Express ne connaît pas les utilisateurs, il vérifie seulement `X-API-Key`.
- La ligne PostgreSQL n'est pas effacée physiquement : elle passe à `deleted` pour garder l'audit.
- Le fichier est retiré du volume local si possible.

Exemple Edge Function simplifiée :

```ts
Deno.serve(async (request) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return new Response('Bad Request', { status: 400 });

  // Vérifier ici le JWT, l'utilisateur et le rôle autorisé à supprimer.

  const mediaResponse = await fetch(`${Deno.env.get('MEDIA_API_URL')}/api/v1/media/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': Deno.env.get('MEDIA_API_KEY')!,
    },
    body: JSON.stringify({
      deletedReference: 'supabase-user-or-operation-id',
      reason: 'removed_by_admin',
    }),
  });

  return new Response(await mediaResponse.arrayBuffer(), {
    status: mediaResponse.status,
    headers: {
      'Content-Type': mediaResponse.headers.get('Content-Type') ?? 'application/json',
    },
  });
});
```

## 7. Erreurs

Toutes les erreurs Express utilisent `application/problem+json`.

| Cas                                           | Statut |
| --------------------------------------------- | ------ |
| `X-API-Key` absente ou incorrecte             | `401`  |
| Champ `photo` absent ou mauvais multipart     | `400`  |
| Corps JSON de suppression invalide            | `400`  |
| MIME déclaré hors `image/jpeg` ou `image/png` | `415`  |
| Magic bytes non JPEG/PNG                      | `415`  |
| Fichier trop volumineux                       | `413`  |
| Trop de requêtes d'upload                     | `429`  |
| Image publique introuvable                    | `404`  |

Exemple :

```json
{
  "type": "about:blank",
  "title": "Image non prise en charge",
  "status": 415,
  "detail": "Seuls les fichiers JPEG et PNG sont acceptés.",
  "requestId": "2dbdbe5b-df3b-4a91-84c8-9d1d1158b11d"
}
```

## 8. Test rapide

```bash
curl -X POST "$MEDIA_API_URL/api/v1/media" \
  -H "X-API-Key: $MEDIA_API_KEY" \
  -F "photo=@./photo.jpg;type=image/jpeg" \
  -F "name=Photo du culte" \
  -F "externalReference=test-supabase"
```

Sans la clé technique, l'appel doit retourner `401`. Avec un faux JPEG contenant du texte, l'appel
doit retourner `415`.
