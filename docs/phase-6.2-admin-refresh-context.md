# Contexte — Phase 6.2 : Endpoint Admin + Refresh BullMQ

## État des lieux

### Ce qui existe déjà (phase 6.2 pré-créée dans worker.ts)
- ✅ Fonction `refreshMaterializedViews()` dans `worker.ts` — boucle sur les 8 vues matérialisées avec `REFRESH MATERIALIZED VIEW CONCURRENTLY`
- ✅ Job cron BullMQ `refresh-materialized-views` planifié chaque nuit à 4h du matin dans `worker.ts` (`getCronRepeatJobs`)
- ✅ Worker `createCronWorker` dans `worker.ts` gère déjà ce job
- ✅ Les 8 vues matérialisées sont définies dans la constante `MATERIALIZED_VIEWS` du worker

### Ce qu'il reste à développer

| Composant | Statut | Description |
|-----------|--------|-------------|
| Module `admin` NestJS | ❌ À créer | `admin.module.ts`, `admin.controller.ts` |
| `POST /admin/refresh-materialized-views` | ❌ À créer | Déclenchement manuel du refresh via BullMQ |
| Admin guard (rôle admin) | ❌ À créer | Vérification par email fixe dans `ADMIN_EMAILS` (`.env`) |
| BullMQ queue `dataviz` | ❌ À créer | Nouvelle queue dédiée (ou réutilisation queue cron ?) |
| Tests | ❌ À créer | Tests unitaires controller + service admin |

## Dépendances

### Externes
- `@emdb/db` → `refreshMaterializedViews()` déjà dans worker
- `bullmq` → Queue, Worker, JobScheduler (déjà présent dans `apps/worker`)
- `auth` → `JwtAuthGuard`, `@CurrentUser()`
- `PrismaService` → via `@emdb/db`

### Schéma concerné
Aucun schéma Prisma — les vues matérialisées vivent en SQL pur.

## Endpoint prévu

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/admin/refresh-materialized-views` | JWT + admin | Déclenchement manuel du refresh BullMQ |

### Réponse attendue
```json
{
  "jobId": "abc-123",
  "status": "queued",
  "message": "Rafraîchissement des vues matérialisées planifié"
}
```

## Architecture proposée

```
apps/api/src/admin/
├── admin.module.ts          ← Module NestJS
├── admin.controller.ts      ← Controller avec endpoints admin
├── admin.guard.ts           ← Guard vérifiant le rôle admin (ADMIN_EMAILS)
├── admin.service.ts         ← Service BullMQ (add job)
└── admin.service.spec.ts    ← Tests
```

### BullMQ
- **Option A** : Queue `dataviz` dédiée + nouveau Worker dans le worker service
- **Option B** : Réutilisation de la queue `tmdb-cron` existante (le job `refresh-materialized-views` y est déjà défini)

## Questions stratégiques à trancher

1. **Queue BullMQ pour le refresh** : Nouvelle queue `dataviz` dédiée ou réutiliser la queue `tmdb-cron` existante ? Le job `refresh-materialized-views` y est déjà programmé en cron.
2. **Mécanisme admin** : ADMIN_EMAILS en `.env` (simple, liste d'emails séparés par virgules) ou plutôt un flag `is_admin` en base utilisateur ?
3. **Communication API → Worker** : Est-ce que l'API doit ajouter le job directement dans BullMQ (via une connexion Redis directe depuis le module admin) ou passer par un microservice NestJS ?
4. **Scope du refresh** : Faut-il un paramètre `viewName?` optionnel pour ne rafraîchir qu'une vue spécifique, ou toujours les 8 ?
5. **Timeout worker** : 5 minutes comme prévu dans la roadmap, ou plus (les vues peuvent être longues avec beaucoup de données) ?

# TODO — Phase 6.2 : Admin Refresh BullMQ

## Décisions stratégiques
- ✅ **Queue** : Réutilisation de `tmdb-cron` existante (Option B)
- ✅ **Mécanisme admin** : `ADMIN_EMAILS` en `.env` (Option A)
- ✅ **Communication** : BullMQ Queue standard depuis l'API (Option C)
- ✅ **Scope** : Refresh des 8 vues sans paramètre (Option A)
- ✅ **Timeout** : 5 minutes (roadmap)

## Étapes
- [x] 1. Créer `admin.guard.ts` — Guard vérifiant ADMIN_EMAILS
- [x] 2. Créer `admin.service.ts` — Service BullMQ (add job to tmdb-cron)
- [x] 3. Créer `admin.controller.ts` — POST /admin/refresh-materialized-views
- [x] 4. Créer `admin.module.ts` — Module NestJS
- [x] 5. Modifier `app.module.ts` — Importer AdminModule
- [x] 6. Ajouter `bullmq` + `ioredis` aux dépendances API
- [x] 7. Installer les dépendances
- [x] 8. Créer `admin.service.spec.ts` — Tests unitaires
- [x] 9. Tests unitaires Phase 6.1 ✅ (14/14)
- [x] 10. Tests unitaires Phase 6.2 ✅ (4/4)
- [x] 11. CI locale : 82 tests pass (6 integration tests DB-dépendants échouent — PostgreSQL non lancé localement)
- [ ] 12. Commit