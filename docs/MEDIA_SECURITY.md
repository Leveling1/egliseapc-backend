# Sécurité du service média

## Frontières de confiance

Supabase décide quel utilisateur peut envoyer une image. Cette API ne connaît pas les utilisateurs :
elle autorise seulement le client technique qui présente `X-API-Key`. La vérification est effectuée
avant Multer afin qu’un appel non autorisé ne puisse pas consommer la mémoire réservée aux fichiers.

## Pipeline d’upload

1. Vérification `X-API-Key` : refuse immédiatement tout appel qui ne connaît pas le secret technique
   partagé avec Supabase.
2. Rate limiting Redis : limite les uploads par fenêtre de temps, même si plusieurs instances de
   l’API tournent derrière un reverse proxy.
3. Limites Multer : accepte un seul champ fichier `photo`, une taille maximale stricte et très peu
   de champs texte.
4. Vérification du MIME déclaré : rejette tôt les fichiers annoncés comme SVG, PDF, ZIP ou autre.
   Ce n’est qu’un filtre rapide, pas une preuve de sécurité.
5. Magic bytes avec `file-type` : lit la signature réelle du fichier pour confirmer JPEG ou PNG.
   Cette étape bloque les fichiers renommés en `.jpg`.
6. Décodage Sharp : force libvips à comprendre réellement l’image et applique une limite de pixels
   pour éviter les images décompressées géantes.
7. Réencodage Sharp : génère un nouveau JPEG ou PNG propre à partir des pixels décodés.
8. Suppression des métadonnées : les données EXIF/GPS/profil non nécessaires ne sont pas recopiées
   dans la nouvelle sortie.
9. Calcul SHA-256 : produit une empreinte stable du fichier normalisé, utilisée notamment comme
   ETag public.
10. Création d’un nom unique : normalise le nom lisible, ajoute 16 caractères aléatoires et reprend
    l’extension depuis le type réellement détecté.
11. Écriture dans le volume : écrit hors du code source et refuse l’écrasement si le nom existe déjà.
12. Activation PostgreSQL : la ligne commence en `pending` puis passe à `ready` uniquement après
    l’écriture réussie.
13. Réponse `201` : retourne un JSON contenant l’URL publique complète construite depuis
    `MEDIA_PUBLIC_BASE_URL`.

## Lecture publique

`GET /media/:filename` ne lit que les lignes `ready`. Le nom doit correspondre à une expression
stricte et le stockage vérifie que le chemin reste dans son répertoire racine. Les réponses portent
un ETag SHA-256, un cache public immuable, un CORS de lecture public et une politique de ressource
`cross-origin` pour permettre l’affichage depuis les sites consommateurs.

Une URL publique n’est pas un contrôle d’accès. Toute personne qui la possède peut voir l’image. Si
les médias deviennent privés, remplacer cette route par des URL signées à durée courte.

## Suppression

`DELETE /api/v1/media/:id` est une écriture privée réservée à Supabase avec `X-API-Key`. Supabase
doit vérifier l’utilisateur et le rôle avant d’appeler cette route.

La suppression côté API est une transition `ready` vers `deleted`. La ligne PostgreSQL reste
présente pour l’audit, avec `deleted_at`, `deleted_reference` et `deletion_reason` si fournis. Le
fichier est retiré du volume local si possible, et `GET /media/:filename` retourne ensuite `404`.

Une migration conserve le trigger PostgreSQL qui refuse les suppressions physiques de lignes
`media_assets`. Les volumes et sauvegardes restent administrables par les opérateurs du serveur ; une
immutabilité absolue exige un stockage objet WORM/Object Lock.

## Limites et exploitation

- Le stockage en mémoire Multer est borné à un fichier et à une taille stricte.
- Redis partage la limite d’upload entre plusieurs instances de l’API.
- Ne journaliser ni `X-API-Key`, ni JWT, ni cookie.
- Faire tourner le conteneur en utilisateur non-root.
- Utiliser HTTPS, des secrets distincts par environnement et une rotation régulière.
- Surveiller l’espace disque, le nombre d’uploads refusés et les lignes `failed`/`pending` anciennes.
- Scanner les dépendances en CI et maintenir Sharp/libvips à jour.

## Risques à surveiller

| Risque                                | Réponse actuelle                                                |
| ------------------------------------- | --------------------------------------------------------------- |
| Clé API volée                         | Rotation du secret, HTTPS obligatoire, ne jamais exposer au web |
| Supabase contourné depuis Internet    | `X-API-Key`, pare-feu ou allowlist IP si possible               |
| Fichier renommé en `.jpg`             | Magic bytes puis décodage Sharp                                 |
| Image trop lourde après décompression | `MEDIA_MAX_INPUT_PIXELS`                                        |
| Remplissage disque                    | Taille maximale, rate limit, supervision du volume              |
| Collision ou écrasement de fichier    | Suffixe aléatoire et écriture `wx`                              |
| Path traversal                        | Nom public strict et résolution dans le dossier racine          |
| Métadonnées GPS/EXIF                  | Réencodage sans copie des métadonnées                           |
| Suppression directe SQL               | Trigger PostgreSQL anti-delete physique                         |
| Suppression utilisateur directe       | Route `DELETE` protégée par `X-API-Key`, décision côté Supabase |

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
