# Setup — Phase 0

Ce document couvre uniquement la Phase 0 de `emdb_roadmap_backend.md` : le socle
technique, avant tout développement métier.

## 1. Pré-requis

- Node.js ≥ 20
- Docker + Docker Compose
- (optionnel en local) `psql` pour interagir directement avec Postgres

## 2. Installation

```bash
git clone <repo>
cd emdb
cp .env.example .env   # puis renseigner TMDB_API_KEY au minimum
npm install
```

## 3. Lancer l'infra locale

```bash
npm run docker:up
```

Cela démarre 4 services :

| Service    | Port  | Rôle                                                        |
|------------|-------|--------------------------------------------------------------|
| `postgres` | 5432  | Base Postgres vierge, `db_init.sql` appliqué au 1er démarrage |
| `redis`    | 6379  | Cache TMDB + queues BullMQ                                    |
| `api`      | 3001  | NestJS (placeholder `/health` en Phase 0)                     |
| `worker`   | —     | Process BullMQ (placeholder en Phase 0, connexion Redis only) |

Vérifier que tout tourne :

```bash
npm run docker:logs
curl http://localhost:3001/health
# → {"status":"ok","service":"emdb-api"}
```

## 4. Prisma (préparation — l'introspection réelle est Phase 1)

Le `schema.prisma` de `packages/db` est un placeholder tant que `db_init.sql`
n'a pas été appliqué + introspecté :

```bash
npm run prisma:pull       # prisma db pull
npm run prisma:generate   # prisma generate
```

## 5. Qualité de code

```bash
npm run lint
npm run format
npm run test
```

## 6. CI

`.github/workflows/ci.yml` : sur chaque push/PR sur `main`, exécute
`lint` → `format:check` → application du SQL sur une base Postgres éphémère →
introspection Prisma (dry-run) → `test`.

## Ce qui n'est PAS encore fait (volontairement, hors Phase 0)

- Aucun module métier NestJS (`auth`, `titles`, `users`...) → Phase 3
- Aucun client TMDB ni job d'import → Phase 2
- Aucune queue BullMQ définie → Phase 2.4
- `schema.prisma` réel (introspecté) → Phase 1.1
- Seeds `seed_genres.ts` / `seed_countries.ts` → Phase 1.1
