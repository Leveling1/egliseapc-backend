# Integration du service media externe

Ce document est destine au backend Supabase qui consomme l'API media comme un service externe.
Supabase reste responsable des utilisateurs, des roles et des decisions metier. Cette API ne gere
que la validation, le stockage et la publication d'images JPEG/PNG.

## 1. Responsabilites

```text
Client
  -> Supabase Auth + Edge Function
  -> API media Express
  -> PostgreSQL + volume media
  <- JSON avec URL publique
```

Supabase doit verifier :

- le JWT de l'utilisateur ;
- le role ou la permission ;
- le fait que l'action d'upload est autorisee ;
- la conservation de l'URL retournee dans ses propres tables.

L'API media verifie uniquement :

- que l'appel vient d'un client technique autorise avec `X-API-Key` ;
- que le fichier est une vraie image JPEG ou PNG ;
- que le fichier est reencode avant stockage ;
- que l'URL publique retournee pointe vers l'image conservee.

## 2. Secrets a configurer

Generer une cle privee longue :

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Sur le serveur Express, dans `.env` :

```env
INTEGRATION_API_KEY=<meme-valeur-que-media-api-key>
MEDIA_PUBLIC_BASE_URL=https://api.example.com/media
```

Dans Supabase :

```bash
supabase secrets set MEDIA_API_URL=https://api.example.com
supabase secrets set MEDIA_API_KEY=<meme-valeur-que-integration-api-key>
```

`SUPABASE_ANON_KEY` n'est pas utilisee par Express. Elle peut servir dans l'Edge Function pour
verifier l'utilisateur Supabase, mais elle ne doit pas proteger l'appel vers l'API media. Le secret
serveur-a-serveur est `MEDIA_API_KEY` cote Supabase et `INTEGRATION_API_KEY` cote Express.

## 3. Upload depuis Supabase

Endpoint appele par l'Edge Function :

```http
POST /api/v1/media
X-API-Key: <MEDIA_API_KEY>
Content-Type: multipart/form-data
```

Champs form-data :

| Champ               | Requis | Description                                                              |
| ------------------- | ------ | ------------------------------------------------------------------------ |
| `photo`             | oui    | Fichier JPEG ou PNG. Un seul fichier par requete.                        |
| `name`              | non    | Nom lisible souhaite. Le serveur le nettoie et ajoute un suffixe unique. |
| `externalReference` | non    | Reference opaque Supabase, par exemple id utilisateur ou operation.      |

Reponse `201 application/json` :

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

Le controle `permissions.includes('media:upload')` est un exemple. Utiliser la regle de role deja
presente dans le projet Supabase.

## 5. Lecture publique

L'URL retournee dans `url` est directement exploitable dans un navigateur ou dans une balise image :

```text
https://api.example.com/media/photo-du-culte-a1b2c3d4e5f60708.jpg
```

`GET /media/:filename` est public. Une URL publique n'est donc pas un secret : toute personne qui la
possede peut voir l'image.

## 6. Suppression

Aucune route `DELETE` n'est exposee par cette API.

Raison : dans le besoin actuel, le service media doit conserver les fichiers et ne permettre a
personne de supprimer via HTTP. PostgreSQL contient aussi un trigger qui refuse les `DELETE` sur
`media_assets`.

Si le produit a besoin de "retirer" une image plus tard, la bonne evolution sera :

- Supabase decide si l'utilisateur peut retirer l'image ;
- Supabase appelle un endpoint dedie, par exemple `PATCH /api/v1/media/:id/archive` ;
- l'API marque l'image comme non publiee au lieu de supprimer physiquement le fichier ;
- `GET /media/:filename` retourne ensuite `404`.

Ce endpoint n'est pas implemente pour l'instant afin de respecter la regle "personne ne supprime".

## 7. Erreurs

Toutes les erreurs Express utilisent `application/problem+json`.

| Cas                                           | Statut |
| --------------------------------------------- | ------ |
| `X-API-Key` absente ou incorrecte             | `401`  |
| Champ `photo` absent ou mauvais multipart     | `400`  |
| MIME declare hors `image/jpeg` ou `image/png` | `415`  |
| Magic bytes non JPEG/PNG                      | `415`  |
| Fichier trop volumineux                       | `413`  |
| Trop de requetes d'upload                     | `429`  |
| Image publique introuvable                    | `404`  |

Exemple :

```json
{
  "type": "about:blank",
  "title": "Image non prise en charge",
  "status": 415,
  "detail": "Seuls les fichiers JPEG et PNG sont acceptes.",
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

Sans la cle technique, l'appel doit retourner `401`. Avec un faux JPEG contenant du texte, l'appel
doit retourner `415`.
