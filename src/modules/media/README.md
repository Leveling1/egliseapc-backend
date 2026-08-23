# Module Media

Ce module implémente le service externe appelé par Supabase.

```text
media.routes → media.controller → media.service
                                  ├── image-processor
                                  ├── media.repository → PostgreSQL
                                  └── local-media-storage → volume privé
```

`POST /api/v1/media` est protégé par une clé d’intégration avant Multer. `GET /media/:filename` est
public et ne retourne que les lignes `ready`. La validation combine limites multipart, MIME déclaré,
magic bytes, décodage et réencodage Sharp. Aucune route `DELETE` n’existe.

Le stockage et le repository sont derrière des interfaces de `media.types.ts`, ce qui permet de
remplacer le volume local par un adaptateur S3-compatible sans modifier le contrôleur ni le service.
