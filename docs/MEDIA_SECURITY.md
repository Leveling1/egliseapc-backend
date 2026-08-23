# Sécurité du service média

## Frontières de confiance

Supabase décide quel utilisateur peut envoyer une image. Cette API ne connaît pas les utilisateurs :
elle autorise seulement le client technique qui présente `X-API-Key`. La vérification est effectuée
avant Multer afin qu’un appel non autorisé ne puisse pas consommer la mémoire réservée aux fichiers.

## Pipeline d’upload

1. Clé d’intégration comparée en temps constant.
2. Rate limiting global et limite dédiée à l’upload.
3. Un fichier multipart nommé `photo`, deux champs texte au maximum.
4. Taille maximale configurable, 5 Mio par défaut.
5. MIME déclaré limité à `image/jpeg` et `image/png` comme filtre préliminaire.
6. Détection du contenu réel avec `file-type`.
7. Décodage Sharp avec limite de pixels, 40 millions par défaut.
8. Rotation selon l’orientation puis réencodage JPEG ou PNG.
9. Métadonnées retirées par la nouvelle sortie.
10. SHA-256 calculé sur les octets normalisés.
11. Nom normalisé, suffixe aléatoire et extension issue des magic bytes.
12. Écriture atomique sans écrasement (`wx`) hors du répertoire source.
13. Passage de la ligne PostgreSQL de `pending` à `ready` seulement après l’écriture.

## Lecture publique

`GET /media/:filename` ne lit que les lignes `ready`. Le nom doit correspondre à une expression
stricte et le stockage vérifie que le chemin reste dans son répertoire racine. Les réponses portent
un ETag SHA-256, un cache public immuable, un CORS de lecture public et une politique de ressource
`cross-origin` pour permettre l’affichage depuis les sites consommateurs.

Une URL publique n’est pas un contrôle d’accès. Toute personne qui la possède peut voir l’image. Si
les médias deviennent privés, remplacer cette route par des URL signées à durée courte.

## Suppression

Aucune route HTTP `DELETE` n’existe. Une migration ajoute aussi un trigger PostgreSQL qui refuse les
suppression de lignes `media_assets`. Les volumes et sauvegardes restent administrables par les
opérateurs du serveur ; une immutabilité absolue exige un stockage objet WORM/Object Lock.

## Limites et exploitation

- Le stockage en mémoire Multer est borné à un fichier et à une taille stricte.
- Redis partage la limite d’upload entre plusieurs instances de l’API.
- Ne journaliser ni `X-API-Key`, ni JWT, ni cookie.
- Faire tourner le conteneur en utilisateur non-root.
- Utiliser HTTPS, des secrets distincts par environnement et une rotation régulière.
- Surveiller l’espace disque, le nombre d’uploads refusés et les lignes `failed`/`pending` anciennes.
- Scanner les dépendances en CI et maintenir Sharp/libvips à jour.

## Réponses attendues

| Situation                                  | Statut |
| ------------------------------------------ | ------ |
| Clé absente ou incorrecte                  | `401`  |
| Champ `photo` absent ou multipart invalide | `400`  |
| Fichier au-dessus de la limite             | `413`  |
| MIME ou contenu réel non JPEG/PNG          | `415`  |
| Trop d’uploads                             | `429`  |
| Image publique inconnue                    | `404`  |

Toutes les erreurs utilisent `application/problem+json` avec un `requestId` de corrélation.
