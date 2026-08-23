# Eglise APC — Media Backend API

> Backend sécurisé d'upload et de conservation de photos JPEG/PNG.
> Monolithe modulaire — Express 5 · TypeScript · PostgreSQL (SQL pur) · Redis · Docker

---

## Table des matières

1. [Présentation](#présentation)
2. [Objectifs de sécurité](#objectifs-de-sécurité)
3. [Stack technologique](#stack-technologique)
4. [Architecture du projet](#architecture-du-projet)
5. [Démarrage en développement](#démarrage-en-développement)
6. [Environnement de production](#environnement-de-production)
7. [Variables d'environnement](#variables-denvironnement)
8. [SQL pur et migrations](#sql-pur-et-migrations)
9. [API et Swagger](#api-et-swagger)
10. [Commandes et tests](#commandes-et-tests)
11. [Intégration continue](#intégration-continue)
12. [Prochaines étapes](#prochaines-étapes)

---

## Présentation

Ce dépôt contient le socle backend du service média de l'Eglise APC. À terme, seuls des utilisateurs
explicitement autorisés pourront envoyer des images, seuls les formats JPEG et PNG réellement
valides seront conservés, et aucune capacité de suppression ne sera exposée par l'API.

Cette livraison correspond à **l'initialisation** : infrastructure, architecture, sécurité HTTP,
documentation, migrations SQL et qualité de code. Les routes métier d'authentification et d'upload
ne sont pas encore implémentées afin de construire chaque étape avec son modèle de menace et ses
tests.

Le backend est organisé en **monolithe modulaire**. Il reste simple à déployer comme un seul service,
mais chaque domaine isole ses routes, contrôleurs, services, validations et requêtes SQL.

## Objectifs de sécurité

Le futur flux média devra appliquer tous les contrôles suivants :

1. authentification obligatoire et autorisation par rôle avant la lecture du multipart ;
2. limites strictes sur le nombre de fichiers, la taille individuelle et la requête totale ;
3. détection par signature binaire (« magic bytes »), sans confiance dans le nom ou le MIME client ;
4. décodage et réencodage pour neutraliser les contenus parasites et retirer les métadonnées ;
5. noms générés côté serveur, hash SHA-256 et stockage hors de tout répertoire statique public ;
6. métadonnées d'audit en PostgreSQL et rate limiting distribué avec Redis ;
7. aucune route HTTP `DELETE` et stockage configuré pour l'immutabilité/rétention.

> **Portée de “personne ne peut supprimer”** — l'API ne possédera aucune fonction de suppression.
> Un administrateur ayant accès au serveur ou au volume garde techniquement le contrôle du stockage.
> Une garantie réglementaire absolue demandera un stockage objet WORM avec verrouillage de rétention.

## Stack technologique

| Couche          | Technologie                      | Rôle                                                   |
| --------------- | -------------------------------- | ------------------------------------------------------ |
| Runtime         | Node.js 24                       | Runtime LTS utilisé localement et dans Docker          |
| API             | Express 5 + TypeScript strict    | HTTP, middlewares et routage versionné                 |
| Validation      | Zod                              | Validation de l'environnement puis des futurs payloads |
| Base de données | PostgreSQL 17 + `pg`             | SQL pur, métadonnées et audit                          |
| Cache           | Redis 8 + `node-redis`           | Rate limits, sessions et données temporaires           |
| Contrat API     | OpenAPI 3.1 + Swagger UI         | Documentation interactive                              |
| Logs            | Pino + pino-http                 | Logs structurés et secrets masqués                     |
| Sécurité HTTP   | Helmet, CORS, express-rate-limit | En-têtes, origines et limitation de débit              |
| Tests           | Vitest + Supertest               | Tests unitaires et intégration HTTP                    |
| Qualité         | ESLint + Prettier                | Règles strictes et format uniforme                     |
| Exécution       | Docker + Docker Compose          | Environnements reproductibles                          |

Aucun ORM ni query builder n'est utilisé.

## Architecture du projet

```text
egliseapc-backend/
├── src/
│   ├── modules/
│   │   ├── auth/                       # Prochaine étape : identité et rôles
│   │   │   └── README.md
│   │   ├── media/                      # Prochaine étape : upload et stockage
│   │   │   └── README.md
│   │   └── health/                     # Liveness et readiness
│   │       ├── health.routes.ts
│   │       ├── health.controller.ts
│   │       └── health.service.ts
│   ├── infrastructure/
│   │   ├── cache/redis.ts              # Client Redis partagé
│   │   ├── database/postgres.ts        # Pool PostgreSQL partagé
│   │   ├── database/migrate.ts         # Runner de migrations SQL
│   │   └── lifecycle.ts                # Connexions et arrêt gracieux
│   ├── shared/
│   │   ├── http/                       # Contexte requête et erreurs RFC 9457
│   │   └── logger.ts                   # Logs structurés et redaction
│   ├── config/                         # Environnement et OpenAPI
│   ├── app.ts                          # Composition Express testable
│   ├── routes.ts                       # Agrégation sous /api/v1
│   └── server.ts                       # Bootstrap réseau
├── database/
│   ├── migrations/                     # SQL versionné, immuable après application
│   └── seeds/                          # Futures données locales non sensibles
├── docs/ARCHITECTURE.md                # Règles de dépendances détaillées
├── tests/                              # Tests HTTP et futurs tests par module
├── compose.dev.yaml                    # Développement : hot reload et ports locaux
├── compose.prod.yaml                   # Production : réseau privé et migration préalable
├── Dockerfile                          # Targets development/build/production
├── agent.mmd                           # Diagramme Mermaid de l'architecture
└── AGENTS.md                           # Règles de contribution pour les agents
```

Chaque module métier suivra ce flux :

```text
route → controller → service → repository SQL / adaptateur externe
```

- la route compose les middlewares ;
- le contrôleur traduit HTTP, sans logique métier ;
- le service porte les invariants métier, sans dépendre d'Express ;
- le repository exécute exclusivement des requêtes SQL paramétrées ;
- le schema Zod valide les données à la frontière.

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) et [agent.mmd](agent.mmd) pour les règles complètes.

## Démarrage en développement

### Option A — pile Docker complète

```powershell
Copy-Item .env.example .env
# Modifier les mots de passe dans .env
npm run docker:dev
```

`compose.dev.yaml` lit `.env`, monte le code pour le hot reload et expose seulement sur
`127.0.0.1` : API `3000`, PostgreSQL `5432`, Redis `6379`.

### Option B — API locale, dépendances dans Docker

```bash
docker compose -f compose.dev.yaml up -d postgres redis
npm install
npm run db:migrate
npm run dev
```

Accès utiles :

- API : `http://localhost:3000/api/v1/health/live`
- readiness : `http://localhost:3000/api/v1/health/ready`
- Swagger UI : `http://localhost:3000/docs`

Pour arrêter sans effacer les volumes :

```bash
npm run docker:dev:down
```

## Environnement de production

Le serveur possède son propre fichier `.env`, au même emplacement et avec les mêmes clés que le
poste local, mais avec des secrets et réglages de production différents. Ce fichier n'est jamais
commité ni copié depuis le dépôt.

```bash
# Sur le serveur, après création sécurisée de .env
npm run docker:prod
```

`compose.prod.yaml` :

- ne publie ni PostgreSQL ni Redis sur l'hôte ;
- place les services sur un réseau Docker interne ;
- exécute les migrations SQL dans un conteneur éphémère avant l'API ;
- lance l'API avec un utilisateur Linux non-root ;
- conserve PostgreSQL, Redis et les futurs médias dans des volumes dédiés ;
- redémarre les services persistants et vérifie leur santé.

L'API écoute par défaut sur `127.0.0.1:3000`, prête à être placée derrière un reverse proxy TLS.
Définir `TRUST_PROXY=1` uniquement s'il existe exactement un proxy de confiance. Mettre
`SWAGGER_ENABLED=false` si la documentation ne doit pas être publique.

## Variables d'environnement

| Variable             | Développement         | Production                      |
| -------------------- | --------------------- | ------------------------------- |
| `NODE_ENV`           | `development`         | `production`                    |
| `PORT`               | `3000`                | `3000` dans le conteneur        |
| `API_BIND_ADDRESS`   | `127.0.0.1`           | `127.0.0.1` derrière proxy      |
| `API_PORT`           | `3000`                | Port choisi sur le serveur      |
| `LOG_LEVEL`          | `debug` ou `info`     | `info`                          |
| `TRUST_PROXY`        | `0`                   | Nombre exact de proxies         |
| `CORS_ORIGINS`       | URL du frontend local | Origine HTTPS réelle            |
| `SWAGGER_ENABLED`    | `true`                | Selon la politique d'accès      |
| `DATABASE_URL`       | URL locale            | Injectée vers le service Docker |
| `REDIS_URL`          | URL locale            | Injectée vers le service Docker |
| `MEDIA_STORAGE_PATH` | `./uploads`           | `/data/media`                   |
| `POSTGRES_*`         | Identifiants locaux   | Secrets forts et uniques        |
| `REDIS_PASSWORD`     | Secret local          | Secret fort et unique           |

Les URL contenant des caractères spéciaux doivent être encodées. La configuration applicative est
validée par Zod et bloque le démarrage en cas d'erreur. `.env.example` est le seul fichier modèle ;
`.env` est ignoré par Git.

## SQL pur et migrations

Créer une migration sous la forme `database/migrations/NNN_description.sql`, puis lancer :

```bash
npm run db:migrate
```

Le runner :

- trie les fichiers par numéro ;
- protège l'exécution concurrente avec un advisory lock PostgreSQL ;
- exécute chaque fichier dans une transaction ;
- enregistre son SHA-256 dans `schema_migrations` ;
- refuse une migration déjà appliquée dont le contenu a changé.

Toutes les valeurs externes dans les repositories devront passer par `$1`, `$2`, etc. Une
transaction métier devra utiliser un même client obtenu par `pool.connect()`.

## API et Swagger

Endpoints actuellement disponibles :

| Méthode | Endpoint               | Description               | Statut attendu |
| ------- | ---------------------- | ------------------------- | -------------- |
| `GET`   | `/api/v1/health/live`  | Processus HTTP vivant     | `200`          |
| `GET`   | `/api/v1/health/ready` | PostgreSQL et Redis prêts | `200` ou `503` |
| `GET`   | `/docs`                | Swagger UI, si activé     | `200`          |

Chaque futur endpoint devra être ajouté à OpenAPI dans le même changement que son code et ses
tests. Les erreurs HTTP utilisent `application/problem+json` et incluent un `requestId`.

## Commandes et tests

| Commande                | Rôle                                        |
| ----------------------- | ------------------------------------------- |
| `npm run dev`           | Démarrer avec hot reload                    |
| `npm run build`         | Compiler dans `dist/`                       |
| `npm start`             | Exécuter le build                           |
| `npm test`              | Lancer Vitest                               |
| `npm run test:coverage` | Générer la couverture                       |
| `npm run lint`          | Lancer ESLint strict                        |
| `npm run format`        | Appliquer Prettier                          |
| `npm run check:lines`   | Refuser tout fichier supérieur à 300 lignes |
| `npm run check`         | Types, lint, format, taille et tests        |

Un test ciblé se lance avec :

```bash
npx vitest run tests/health.test.ts
```

## Intégration continue

Le workflow GitHub Actions `.github/workflows/ci.yml` s'exécute sur les pull requests et les pushes
vers `main`. Il installe avec `npm ci`, lance toutes les vérifications, compile TypeScript, valide les
deux fichiers Compose et construit l'image de production. Aucune étape de déploiement continu n'est
ajoutée tant que le serveur cible n'est pas choisi.

## Prochaines étapes

1. définir le mode d'authentification et le modèle de rôles des téléverseurs ;
2. créer le schéma SQL `users/principals`, les migrations et le module `auth` ;
3. choisir la limite de taille, le nombre d'images et la politique de rétention ;
4. implémenter le module `media` avec validation binaire et réencodage ;
5. ajouter tests d'attaque, audit et documentation Swagger exhaustive.

## Références de sécurité

- [Bonnes pratiques de sécurité Express](https://expressjs.com/en/advanced/best-practice-security/)
- [Sécurité et limites Multer](https://expressjs.com/en/resources/middleware/multer/)
- [Pool node-postgres](https://node-postgres.com/features/pooling)
- [Client Node.js officiel Redis](https://redis.io/docs/latest/develop/clients/nodejs/connect/)

---

Avant toute contribution, lire [AGENTS.md](AGENTS.md). L'architecture privilégie des fichiers courts,
une responsabilité par composant et une limite automatisée de **300 lignes par fichier**.
