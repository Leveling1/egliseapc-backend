# Architecture technique

## Style retenu

L'application est un monolithe modulaire. Elle est déployée comme un seul processus, mais chaque
domaine possède sa propre API interne et ses propres couches. Cette séparation conserve une
exploitation simple sans mélanger authentification, médias et infrastructure.

## Couches d'un module

Le flux d'une requête respecte toujours cet ordre :

```text
route → controller → service → repository/adaptateur
```

- `routes` déclare l'URL, les middlewares et le handler ;
- `controller` traduit HTTP vers des entrées métier et choisit le statut de réponse ;
- `service` applique les règles métier et ne dépend pas d'Express ;
- `repository` contient exclusivement du SQL paramétré avec `pg` ;
- `schema` valide les données externes avec Zod ;
- un adaptateur encapsule le stockage de fichiers ou tout service externe.

Les modules ne lisent pas directement les fichiers internes d'un autre module. Un contrat exporté
sert de frontière lorsqu'une collaboration est nécessaire.

## SQL pur et migrations

Aucun ORM ni query builder n'est utilisé. Le pool `pg` est partagé, avec des requêtes paramétrées
`$1`, `$2`, etc. Les transactions utilisent obligatoirement un client réservé, jamais plusieurs
appels indépendants à `pool.query`.

Les fichiers `database/migrations/NNN_description.sql` sont exécutés dans l'ordre par
`npm run db:migrate`. Chaque migration est transactionnelle, suivie par checksum et protégée par
un advisory lock PostgreSQL. Une migration appliquée ne doit jamais être modifiée : créer le
numéro suivant.

## Cycle de vie

`src/app.ts` construit Express sans ouvrir de socket, ce qui permet les tests HTTP en mémoire.
`src/server.ts` valide l'environnement, vérifie PostgreSQL et Redis, ouvre le port puis enregistre
l'arrêt gracieux. La liveness ne teste que le processus ; la readiness interroge les dépendances.

## Frontière de sécurité média

L'upload sera monté uniquement sur les routes du module `media`, après authentification et contrôle
de rôle. Le service vérifiera taille, quantité, signature binaire, dimensions et décodage, puis
réencodera l'image avant stockage sous un nom généré. Les fichiers ne seront jamais servis depuis
un chemin fourni par le client. Aucune route de suppression ne sera exposée.

## Environnements Docker

`compose.dev.yaml` monte le code et publie API, PostgreSQL et Redis sur l'interface locale.
`compose.prod.yaml` n'expose que l'API, rend le réseau interne et exécute les migrations avant le
démarrage. Les deux lisent `.env`; seul son contenu change entre le poste local et le serveur.
