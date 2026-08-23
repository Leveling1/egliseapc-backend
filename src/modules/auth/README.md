# Module Auth (prochaine étape)

Ce module portera l'authentification des téléverseurs et l'autorisation par rôle. Il sera découpé
en `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.repository.ts` (requêtes SQL
paramétrées) et `auth.schema.ts` (validation Zod). Aucun choix de mécanisme d'identité n'est figé
pendant l'initialisation.
