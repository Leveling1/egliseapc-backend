# Eglise APC — External Media API

> Service Express externe consommé par Supabase pour valider, réencoder, conserver et publier des
> photos JPEG/PNG.

Express 5 · TypeScript strict · PostgreSQL en SQL pur · Redis · Docker · OpenAPI

## Principe

Supabase reste responsable des utilisateurs, sessions, rôles et autorisations. Après avoir autorisé
une action, une Edge Function appelle cette API avec une clé technique privée.

```text
Client → Supabase Auth/roles → Edge Function → API média → PostgreSQL + volume
                                                ↓
                              URL publique /media/nom-unique.jpg
```

Cette API ne contient aucune authentification utilisateur et ne requiert aucune clé Supabase. Elle
authentifie uniquement le service appelant avec `X-API-Key`.

## Fonctionnalités

- `POST /api/v1/media` réservé au client technique Supabase ;
- un seul fichier `photo` JPEG ou PNG par requête ;
- limites de taille, parties multipart, champs et pixels ;
- vérification du MIME déclaré puis des magic bytes avec `file-type` ;
- décodage et réencodage avec Sharp ;
- retrait des métadonnées et calcul SHA-256 ;
- nom lisible normalisé avec suffixe aléatoire ;
- stockage persistant hors du code source ;
- métadonnées immuables dans PostgreSQL ;
- `GET /media/:filename` public, avec ETag et cache immuable ;
- rate limiting Redis pour l’upload ;
- aucune route de suppression.

## Architecture

```text
src/
├── app.ts                         # Composition HTTP sans écoute réseau
├── server.ts                      # Démarrage et arrêt gracieux
├── config/
│   ├── env.ts                     # Validation Zod de l’environnement
│   ├── openapi.ts                 # Contrat OpenAPI principal
│   └── media.openapi.ts           # Contrat du domaine média
├── modules/
│   ├── health/
│   └── media/
│       ├── media.routes.ts        # Middlewares et endpoints
│       ├── media.controller.ts    # Adaptation HTTP
│       ├── media.service.ts       # Orchestration métier
│       ├── media.repository.ts    # SQL paramétré
│       ├── image-processor.ts     # Magic bytes + Sharp
│       ├── media-upload.middleware.ts
│       └── local-media-storage.ts
├── infra/                         # PostgreSQL, Redis, cycle de vie
└── shared/                        # Erreurs, logs, clé d’intégration
```

Le flux respecte `route → controller → service → repository/adaptateur`. Aucun fichier ne doit
dépasser 300 lignes et aucun ORM n’est utilisé. Voir [agent.mmd](agent.mmd).

## Démarrage Docker

Créer le fichier local :

```powershell
Copy-Item .env.example .env
```

Modifier au minimum les mots de passe et `INTEGRATION_API_KEY`, puis démarrer :

```bash
npm run docker:dev
npm run docker:dev:logs
```

`docker:dev` exécute `docker compose up -d --build`. La commande de logs est séparée ; `Ctrl+C`
quitte uniquement leur affichage.

Accès locaux :

- API vivante : `http://localhost:3000/api/v1/health/live`
- API prête : `http://localhost:3000/api/v1/health/ready`
- Swagger : `http://localhost:3000/docs`
- Images publiques : `http://localhost:3000/media/<filename>`

Arrêter les conteneurs sans effacer leurs volumes :

```bash
npm run docker:dev:down
```

## Variables d’environnement

| Variable                     | Rôle                                                | Défaut local                  |
| ---------------------------- | --------------------------------------------------- | ----------------------------- |
| `INTEGRATION_API_KEY`        | Secret reçu dans `X-API-Key`, 32 caractères minimum | clé locale à remplacer        |
| `MEDIA_STORAGE_PATH`         | Répertoire privé des fichiers                       | `./uploads`                   |
| `MEDIA_PUBLIC_BASE_URL`      | Base des URLs retournées                            | `http://localhost:3000/media` |
| `MEDIA_MAX_FILE_SIZE_BYTES`  | Taille binaire maximale                             | `5242880`                     |
| `MEDIA_MAX_INPUT_PIXELS`     | Protection contre les images décompressées géantes  | `40000000`                    |
| `MEDIA_UPLOAD_RATE_LIMIT`    | Uploads/minute par client réseau                    | `30`                          |
| `MEDIA_PUBLIC_CACHE_SECONDS` | Cache des images immuables                          | `31536000`                    |
| `DATABASE_URL`               | Connexion PostgreSQL hors Docker                    | voir `.env.example`           |
| `REDIS_URL`                  | Connexion Redis hors Docker                         | voir `.env.example`           |
| `CORS_ORIGINS`               | Origines navigateur autorisées                      | frontend local                |
| `SWAGGER_ENABLED`            | Active `/docs`                                      | `true`                        |

La clé locale par défaut est interdite automatiquement lorsque `NODE_ENV=production`.

## Contrat d’upload

```http
POST /api/v1/media
X-API-Key: <secret-service>
Content-Type: multipart/form-data
```

Champs :

| Champ               | Requis | Description                                       |
| ------------------- | ------ | ------------------------------------------------- |
| `photo`             | oui    | fichier JPEG ou PNG                               |
| `name`              | non    | nom public lisible, normalisé par le serveur      |
| `externalReference` | non    | référence Supabase opaque, 128 caractères maximum |

Exemple :

```bash
curl -X POST http://localhost:3000/api/v1/media \
  -H "X-API-Key: VOTRE_CLE" \
  -F "photo=@./photo.jpg;type=image/jpeg" \
  -F "name=Photo du culte"
```

Réponse `201` :

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

L’extension est toujours reconstruite depuis le contenu détecté. Un fichier nommé `.jpg` contenant
un PNG sera publié en `.png`; un contenu non JPEG/PNG sera refusé.

## Intégration Supabase

Le document court à transmettre au développeur Supabase est [docs/INTEGRATION.md](docs/INTEGRATION.md).
Le guide plus détaillé couvre la génération du secret, sa configuration, l’Edge Function, l’appel
frontend, les tests et la rotation : [docs/SUPABASE_INTEGRATION.md](docs/SUPABASE_INTEGRATION.md).

Résumé des secrets :

```text
Supabase : MEDIA_API_URL + MEDIA_API_KEY
Express  : INTEGRATION_API_KEY (même valeur que MEDIA_API_KEY)
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` ne sont pas nécessaires dans ce
service, puisqu’il n’appelle pas Supabase.

## Persistance SQL

Les migrations sont dans `database/migrations` :

```bash
npm run db:migrate
```

`media_assets` conserve le nom public, le chemin interne, le type détecté, les dimensions, la taille,
le hash, la référence externe, le statut et la date. Une ligne commence en `pending` puis devient
`ready` seulement après écriture réussie. Un trigger interdit les `DELETE` SQL sur cette table.

## Sécurité

La clé API est comparée en temps constant avant la lecture multipart et masquée dans les logs. Le
stockage refuse les chemins non conformes et les écrasements. Les images publiques sont immuables ;
le même nom humain reçoit toujours un suffixe unique.

Une URL publique est visible par toute personne qui la connaît. Pour des images privées, il faudra
remplacer la lecture publique par des URLs signées. Les garanties et limites sont détaillées dans
[docs/MEDIA_SECURITY.md](docs/MEDIA_SECURITY.md).

## Commandes

| Commande                   | Action                               |
| -------------------------- | ------------------------------------ |
| `npm run dev`              | API TypeScript en watch              |
| `npm run build`            | compilation dans `dist/`             |
| `npm start`                | exécution du build                   |
| `npm test`                 | tests Vitest/Supertest               |
| `npm run test:unit`        | tests unitaires ciblés               |
| `npm run test:integration` | tests HTTP d’intégration             |
| `npm run check`            | types, lint, format, lignes et tests |
| `npm run db:migrate`       | migrations SQL locales               |
| `npm run docker:dev`       | build et démarrage Docker dev        |
| `npm run docker:dev:logs`  | suivi séparé des logs                |
| `npm run docker:prod`      | build et démarrage production        |

## Production

Le serveur utilise un `.env` du même nom que localement, avec des valeurs différentes et jamais
commitées. Configurer au minimum :

```env
NODE_ENV=production
INTEGRATION_API_KEY=<secret-unique>
MEDIA_PUBLIC_BASE_URL=https://api.example.com/media
API_BIND_ADDRESS=127.0.0.1
TRUST_PROXY=1
```

Placer l’API derrière un reverse proxy HTTPS. PostgreSQL et Redis ne sont pas publiés par le Compose
de production. L’utilisateur du conteneur est non-root et le volume `media-data` persiste les images.

```bash
npm run docker:prod
npm run docker:prod:logs
```

## Qualité et CI

La CI lance `npm ci`, l’audit des dépendances de production, toutes les vérifications, le build
TypeScript, la validation des deux fichiers Compose et le build de l’image de production. Les tests
couvrent la clé absente, JPEG/PNG réels, MIME falsifié, format interdit, dépassement de taille, nom
hostile, lecture publique et absence de suppression.
