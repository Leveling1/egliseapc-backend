# Repository Guidelines

## Project Structure & Module Organization

`src/app.ts` compose l'application HTTP sans ouvrir de port ; `src/server.ts` connecte l'infrastructure et gère son cycle de vie. Les fonctionnalités vivent sous `src/modules/<domaine>` et suivent `routes → controller → service → repository/adaptateur`. Les adaptateurs PostgreSQL et Redis restent dans `src/infra`, tandis que les préoccupations transversales sont sous `src/shared`. Les migrations SQL ordonnées résident dans `database/migrations`. Toute nouvelle route publique doit être décrite dans OpenAPI. `agent.mmd` fixe les frontières architecturales.

## Build, Test, and Development Commands

- `npm run dev` : démarre l'API TypeScript en mode watch.
- `npm run build` puis `npm start` : compile dans `dist/` et exécute le build.
- `npm test` : lance tous les tests Vitest ; `npx vitest run tests/health.test.ts` cible un fichier.
- `npm run check` : enchaîne types, lint, format et tests.
- `npm run db:migrate` : applique les migrations SQL pures en attente.
- `npm run docker:dev` construit et démarre la pile en arrière-plan ; `docker:dev:logs` affiche les logs et `docker:dev:down` l'arrête.
- `npm run docker:prod` et les variantes `docker:prod:*` appliquent le même cycle à la production.

## Coding Style & Naming Conventions

TypeScript est strict, en ESM NodeNext. Prettier impose les quotes simples, les points-virgules et une largeur de 100 caractères ; ESLint applique les règles strictes typées. Utiliser des noms de fichiers en kebab-case, des exports nommés et des imports `type` explicites. Aucun fichier ne doit dépasser 300 lignes ; `npm run check:lines` l'impose. Les repositories utilisent `pg`, du SQL paramétré et aucun ORM.

## Testing Guidelines

Les tests unitaires résident dans `tests/unit`. Les tests d'intégration HTTP résident dans `tests/integration` et utilisent Vitest avec Supertest. Ils doivent tester les statuts, le format de réponse et les contrôles de sécurité observables. Lancer `npm run test:coverage` pour produire le rapport local.

## Security & API Contract

Ne jamais faire confiance au MIME ou au nom d'un fichier seul : la future validation média devra vérifier les magic bytes, limiter taille et nombre, réencoder l'image et stocker hors du répertoire public. Toute écriture exigera authentification et autorisation ; aucune route `DELETE` média ne doit être exposée. Ne journaliser ni jeton ni secret. Mettre à jour OpenAPI et les tests dans le même changement que chaque endpoint.
