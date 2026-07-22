# Prisma — Configuration eMDB

Ce dossier contient le schéma Prisma (`schema.prisma`) et les configurations associées pour l'interaction avec la base de données PostgreSQL.

---

## 🗃️ Schéma Prisma

Le schéma (`schema.prisma`) a été généré par **introspection** à partir du fichier SQL source `../sql/db_init.sql` (v2) via la commande :

```bash
npm run db:pull
```

> ⚠️ **Ne pas modifier manuellement `schema.prisma`** — il est généré automatiquement et doit rester synchronisé avec le schéma SQL physique.
> Pour ajouter/modifier des tables, éditez `../sql/db_init.sql` puis relancez `npm run db:pull`.

---

## 🔄 Workflow de migration

### Développement local
1. **Base de données** : Lancée via `docker compose up -d` (utilise `postgres:16-alpine`)
   - Le schéma est initialisé automatiquement via le volume monté :
     ```yaml
     # docker-compose.yml
     - ./packages/db/sql/db_init.sql:/docker-entrypoint-initdb.d/01-db_init.sql:ro
     ```

2. **Génération du client** :
   ```bash
   npm run generate
   ```

3. **Vérification** :
   ```bash
   npm run migrate:dry-run  # Valide que le schéma correspond à la base
   ```

### Production
1. Appliquer les migrations Prisma :
   ```bash
   npm run migrate:deploy
   ```

2. **⚠️ IMPORTANT** : Appliquer les objets SQL **hors Prisma** (voir section ci-dessous).

---

## 🛠️ Objets SQL "Hors Prisma"

Prisma **ne gère pas** les objets suivants (triggers, fonctions, vues matérialisées). 
Ils sont définis dans `../sql/db_init.sql` et doivent être appliqués **manuellement** ou via un script.

> 📌 **Source de vérité** : `packages/db/sql/db_init.sql` (version v2)

### 🎯 Triggers
| Nom | Table | Description |
|-----|-------|-------------|
| `trg_user_ratings_updated_at` | `user_ratings` | Met à jour automatiquement `updated_at` à la date actuelle avant chaque `UPDATE` |

**Fonction associée** : `fn_set_updated_at()` (appelée par le trigger).

---

### 📊 Fonctions PL/pgSQL

Ces fonctions sont utilisées par l'API pour des calculs complexes et ne doivent **pas** être réécrites côté application.

| Nom | Paramètres | Retourne | Utilisation |
|-----|-----------|---------|-------------|
| `fn_episodes_non_vus` | `p_user_id UUID`, `p_title_id UUID` | `INT` | Compte le nombre d'épisodes **sortis et non vus** par un utilisateur pour une série. Utilisée dans le **calendrier** (Phase 4) |
| `fn_progress_serie` | `p_user_id UUID`, `p_title_id UUID` | `TABLE(saison INT, vus INT, total INT)` | Retourne le **progrès par saison** pour une série. Utilisée dans la **page détail série** (Phase 4) |

**Exemple d'appel via Prisma** :
```typescript
// Compter les épisodes non vus
const count = await prisma.$queryRaw<number>(
  `SELECT fn_episodes_non_vus('${userId}', '${titleId}')`
);

// Récupérer le progrès par saison
const progress = await prisma.$queryRaw<{saison: number; vus: number; total: number}[]>(
  `SELECT * FROM fn_progress_serie('${userId}', '${titleId}')`
);
```

---

### 📈 Vues Matérialisées (Dataviz)

Ces vues sont **rafraîchies périodiquement** (via un job worker) et utilisées pour les endpoints de dataviz (Phase 6).

| Nom | Description | Index |
|-----|-------------|-------|
| `mv_watch_time_by_period` | Temps de visionnage **par semaine** (pour les graphiques temporels) | `idx_mv_watch_time_period` (UNIQUE) |
| `mv_watch_time_by_genre` | Temps de visionnage **par genre** | `idx_mv_watch_time_genre` (UNIQUE) |
| `mv_watch_time_by_country` | Temps de visionnage **par pays** | `idx_mv_watch_time_country` (UNIQUE) |
| `mv_watch_time_by_animation` | Temps de visionnage **par type (animation/live-action)** | `idx_mv_watch_time_anim` (UNIQUE) |
| `mv_watch_count_by_genre` | **Compte** de visionnages par genre | `idx_mv_watch_count_genre` (UNIQUE) |

**Rafraîchissement** :
Les vues utilisent `REFRESH MATERIALIZED VIEW CONCURRENTLY`, qui nécessite un **index UNIQUE** (déjà en place).

**Exemple de rafraîchissement** (à exécuter dans un job worker) :
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_watch_time_by_period;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_watch_time_by_genre;
-- ... (pour toutes les MV)
```

> ⚠️ **À implémenter** : Voir **Phase 1.4** de la roadmap (job `refreshMaterializedViews()`).

---

## 🔧 Scripts Utiles

| Commande | Description |
|----------|-------------|
| `npm run generate` | Génère le client Prisma (à exécuter après `db:pull`) |
| `npm run db:pull` | Introspection du schéma SQL → met à jour `schema.prisma` |
| `npm run migrate:dev` | Crée une nouvelle migration (pour les changements de schéma **gérés par Prisma**) |
| `npm run migrate:deploy` | Applique les migrations en production |
| `npm run migrate:dry-run` | Valide que le schéma Prisma correspond à la base |
| `npm run seed` | Exécute les scripts de seed (genres + pays) |
| `npm run seed:genres` | Seed des genres (dynamique via API TMDB) |
| `npm run seed:countries` | Seed des pays (ISO 3166-1 alpha-2) |

---

## 📝 Bonnes Pratiques

1. **Ne pas utiliser Prisma pour** :
   - Créer/modifier des **triggers** ou **fonctions PL/pgSQL**
   - Créer/modifier des **vues matérialisées**
   - Gérer des **contraintes CHECK complexes** (ex: `chk_follow_is_serie` dans `user_follows_serie`)

2. **Toujours tester** les requêtes raw SQL avec `prisma.$queryRaw` avant de les déployer.

3. **Pour les migrations** :
   - Les tables/colonnes standard → **Prisma** (`prisma migrate dev`)
   - Les objets complexes (triggers, fonctions, MV) → **SQL brut** (dans `db_init.sql`)

---

## 🔗 Références

- [Documentation Prisma](https://pris.ly/)
- [Raw SQL avec Prisma](https://pris.ly/d/prisma-client/raw-queries)
- [PostgreSQL — Vues Matérialisées](https://www.postgresql.org/docs/current/sql-creatematerializedview.html)
- [Phase 1.4 — Rafraîchissement des MV](file:///c:/Users/Elie/OneDrive/Bureau/emdb/emdb/emdb_roadmap_backend.md#14-vues-mat%C3%A9rialis%C3%A9es-dataviz---d%C3%A9j%C3%A0-cr%C3%A9%C3%A9es-dans-le-sch%C3%A9ma-v2)
