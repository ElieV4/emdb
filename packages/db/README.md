# @emdb/db

Package partagé contenant le schéma de base de données et le client Prisma.

## Répartition Prisma / SQL brut

- **Prisma** gère ~90% de l'API : CRUD sur `users`, `titles`, `credits`, `people`,
  `seasons`, `episodes`, `user_lists`, `notifications`, etc. Le `schema.prisma`
  de ce package est généré par **introspection** (`prisma db pull`), pas écrit à la main.
- **SQL pur** (`sql/db_init.sql`) reste l'unique source de vérité pour les objets
  que Prisma ne sait pas gérer :
  - le trigger `trg_user_ratings_updated_at`
  - les fonctions PL/pgSQL `fn_episodes_non_vus`, `fn_progress_serie`
  - les 5 vues matérialisées `mv_watch_time_*` / `mv_watch_count_by_genre`

Ces objets sont appliqués une fois via `db_init.sql` (automatiquement en local par
docker-compose, cf. `docker-entrypoint-initdb.d`) et ne sont jamais régénérés par
`prisma migrate`.

## Setup (Phase 1)

```bash
# 1. Démarrer une base vierge
docker compose up -d postgres

# 2. db_init.sql est déjà appliqué automatiquement par l'image postgres
#    (docker-entrypoint-initdb.d), uniquement à la création du volume.
#    Pour ré-appliquer manuellement sur une base existante :
npm run apply-raw-sql --workspace=packages/db

# 3. Générer le schema.prisma par introspection
npm run db:pull --workspace=packages/db

# 4. Générer le client TypeScript
npm run generate --workspace=packages/db
```

## Appel des fonctions PL/pgSQL depuis l'API

Ces fonctions ne sont pas exposées par le client Prisma généré — elles s'appellent
via `prisma.$queryRaw`, par exemple :

```ts
const nonVus = await prisma.$queryRaw<{ fn_episodes_non_vus: number }[]>`
  SELECT fn_episodes_non_vus(${userId}::uuid, ${titleId}::uuid)
`;
```
