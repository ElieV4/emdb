# Roadmap Backend — eMDB (movie/serie tracker)

Basé sur `README.md` et sur `db_init_v2.sql` (schéma finalisé, intégrant les gaps identifiés dès le départ plutôt qu'en rustine).

**Stack retenue** : Node.js + TypeScript + NestJS + **Prisma** + PostgreSQL + Redis + BullMQ.

Répartition Prisma / SQL brut :
- **Prisma** pour ~90% de l'API : tout le CRUD standard (`users`, `titles`, `credits`, `people`, `seasons`, `episodes`, `user_lists`, `notifications`...) → client type-safe généré, migrations gérées via `prisma migrate`.
- **`prisma.$queryRaw` / `$executeRaw`** pour les ~10% de requêtes lourdes ou spécifiques : appel des fonctions PL/pgSQL (`fn_episodes_non_vus`, `fn_progress_serie`), lecture des vues matérialisées dataviz, `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
- Le trigger (`trg_user_ratings_updated_at`) et les vues matérialisées vivent en SQL pur dans une migration Prisma "custom" (Prisma permet d'ajouter du SQL brut dans ses fichiers de migration générés, ou via une migration `prisma migrate dev --create-only` éditée à la main).

---

## Phase 0 — Socle technique (avant tout dev métier)

- [ ] Repo : monorepo `apps/api`, `apps/worker` (jobs TMDB), `packages/db` (schéma + migrations partagées)
- [ ] Docker Compose : `postgres`, `redis`, `api`, `worker`
- [ ] Config env : `.env` (DATABASE_URL, TMDB_API_KEY, TMDB_BASE_URL, REDIS_URL, JWT_SECRET)
- [ ] Outil de migration : **Prisma**. Deux options pour démarrer :
  - (a) partir de `db_init_v2.sql`, l'exécuter tel quel sur une base vierge, puis `prisma db pull` pour générer le `schema.prisma` par introspection (garde le SQL exact, y compris triggers/vues/fonctions qui restent gérés hors Prisma)
  - (b) écrire le `schema.prisma` à la main puis `prisma migrate dev` pour générer les migrations — plus "Prisma-natif" mais demande de recréer triggers/vues/fonctions en migration custom ensuite
  - → recommandé : **(a)**, plus fidèle au SQL déjà pensé et testé dans `db_init_v2.sql`
- [ ] Linter/format (eslint, prettier), tests (jest/vitest), CI (github actions : lint + test + migration dry-run)

---

## Phase 1 — Base de données (détail maximal)

Base = `db_init_v2.sql` (schéma finalisé). Il intègre déjà : `is_animation`, `next_episode_air_date`, `user_follows_serie`, `tmdb_sync_log`, le trigger `updated_at`, les fonctions PL/pgSQL et les vues matérialisées dataviz.

### 1.1 Mise en place initiale
- [ ] Exécuter `db_init_v2.sql` sur une base Postgres vierge (locale, via docker-compose)
- [ ] `prisma db pull` → génère `schema.prisma` par introspection (récupère tables, colonnes, FK, index, contraintes CHECK simples — Prisma ignore triggers/fonctions/vues matérialisées, c'est normal, ils restent en SQL pur)
- [ ] `prisma generate` → client TS type-safe
- [ ] Vérifier `pgcrypto` dispo en prod managée (RDS/Supabase/Neon l'ont en général nativement)
- [ ] Seed scripts (idempotents, hors Prisma migrate — simples scripts TS exécutés à la main ou en job d'init) :
  - `seed_genres.ts` → insère les genres TMDB (liste fixe, cf. 2.2)
  - `seed_countries.ts` → insère la liste ISO 3166-1 alpha-2 complète (fichier statique JSON, pas d'appel API)

### 1.2 Gestion des objets "hors Prisma" (triggers, fonctions, vues matérialisées)
Prisma ne sait ni créer ni versionner triggers/fonctions/vues matérialisées automatiquement. Deux approches possibles, je recommande la première :
- [ ] **(recommandé)** Garder `db_init_v2.sql` comme unique source de vérité pour ces objets, appliqué une fois manuellement (ou via un script `apply-raw-sql.ts` lancé après chaque `prisma migrate deploy`) plutôt que de les faire gérer par Prisma
- [ ] (alternative) Injecter ce SQL dans le dossier de migration généré par Prisma (`prisma/migrations/xxx_init/migration.sql`) pour que `prisma migrate deploy` les applique aussi en prod — plus intégré mais fragile si tu regénères une migration ensuite

- [ ] Documenter clairement dans le repo (`prisma/README.md`) que `trg_user_ratings_updated_at`, `fn_episodes_non_vus`, `fn_progress_serie` et les 5 `mv_*` sont en SQL pur, non touchés par Prisma

### 1.3 Fonctions PL/pgSQL (déjà écrites dans le schéma v2, à exposer côté API)
- [ ] `fn_episodes_non_vus(user_id, title_id) RETURNS INT` — appelée via `prisma.$queryRaw` pour le calendrier
- [ ] `fn_progress_serie(user_id, title_id) RETURNS TABLE(saison, vus, total)` — appelée via `$queryRaw` pour la page série (vue datée par saison)

### 1.4 Vues matérialisées (dataviz — déjà créées dans le schéma v2/v3)
- **Vues "watch_time" (durée)** : `mv_watch_time_by_period`, `mv_watch_time_by_genre`, `mv_watch_time_by_country`, `mv_watch_time_by_animation`
- **Vues "watch_count" (compte)** : `mv_watch_count_by_genre`, `mv_watch_count_by_period`, `mv_watch_count_by_country`, `mv_watch_count_by_animation`
- [x] Job worker `refreshMaterializedViews()` : `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_xxx` pour chacune (index UNIQUE déjà en place dans le schéma pour permettre le mode CONCURRENTLY), cron nocturne
- [x] Script `packages/db/scripts/refresh-materialized-views.ts` implémenté et testé

### 1.5 Contraintes de cohérence à vérifier en tests d'intégration
- [ ] `user_ratings` : double `UNIQUE (user_id, title_id)` / `UNIQUE (user_id, episode_id)` — fonctionne car Postgres ignore les `NULL` dans les contraintes unique, mais à couvrir par un test dédié (comportement parfois surprenant)
- [ ] `list_items.position` : pas de contrainte d'unicité par liste → gestion applicative du ré-ordonnancement à prévoir côté module `lists` (phase 4)
- [ ] `user_follows_serie.chk_follow_is_serie` : la contrainte SQL est un placeholder (`CHECK (true)`) — la vraie validation "ce titre est bien de type serie" doit être faite côté application (service layer), Postgres ne peut pas facilement vérifier une valeur d'une autre table dans un CHECK sans trigger dédié ; à ajouter en trigger `BEFORE INSERT` si on veut une garantie dure en base
- Tests unitaires pour les fonctions PL/pgSQL (via `$queryRaw`)
- Tests d'intégration pour les contraintes de base de données
- Tests E2E pour les workflows critiques
---

## Phase 2 — Intégration API TMDB (détail à la maille fonction)

### 2.1 Client TMDB (module `tmdb-client`)
- [x] `tmdbClient.ts` : wrapper HTTP (fetch) avec :
  - base URL `https://api.themoviedb.org/3`
  - auth via header `Authorization: Bearer <TMDB_API_KEY>` (v4) ou `api_key` query param (v3)
  - gestion du rate limit (token bucket à 40 req/10s avec queue)
  - retry avec backoff exponentiel sur 429/5xx (3 tentatives max, `Retry-After` respecté)
  - cache Redis en lecture (clé = url, TTL 24h configurable via `TMDB_CACHE_TTL_SECONDS`)
- [x] Fonctions bas niveau : `searchMovie`, `searchTv`, `searchPerson`, `searchMulti`, `getMovieDetails`, `getTvDetails`, `getTvSeason`, `getPersonDetails`, `getPersonCombinedCredits`, `getConfiguration`, `getGenreListMovie`, `getGenreListTv`, `getMovieExternalIds`, `getTvExternalIds`, `getPersonExternalIds`, `getTvEpisodeDetails`, `getMovieImages`, `getTvImages`, `getPersonImages`, `getMovieVideos`, `getTvVideos`, `getMovieRecommendations`, `getMovieSimilar`, `getTvRecommendations`, `getTvSimilar`, `getCollectionDetails`, `getTrending`, `getDiscoverMovie`, `getDiscoverTv`, `getChanges`
- [x] Cache Redis optionnel (graceful fallback si Redis indisponible)
- [x] Rate limiter avec file d'attente
- [x] Erreurs TMDB gérées : 401 (clé invalide), 404 (ne pas retry), 429/5xx (retry)

### 2.2 Mapping TMDB → modèle interne (module `tmdb-mapper`)
- [x] `mapTmdbMovieToTitle(tmdbMovie): TitleInsert` — mappe `title/original_title` → `titre_vf/titre_vo`, `release_date` → `date_sortie`, `runtime` → `duree_minutes`, `vote_average` → `note_imdb`, `poster_path` → `affiche_url`
- [x] `mapTmdbTvToTitle(tmdbTv): TitleInsert` — idem + `status` → `statut_serie` (mapping `Returning Series`→`en_cours`, `Ended`/`Canceled`→`terminee`/`annulee`), `next_episode_to_air` → `next_episode_air_date`
- [x] `mapTmdbGenres(tmdbGenres): GenreInsert[]`
- [x] `mapTmdbCountries(iso3166List): CountryInsert[]`
- [x] `mapTmdbCredits(tmdbCredits, titleId): CreditInsert[]` — sépare `cast` (role='acteur', garde `character` → `personnage`, `order` → `ordre`) et `crew` (filtre `job === 'Director'` → role='realisateur', `job === 'Writer'/'Screenplay'` → role='scenariste', reste → 'autre')
- [x] `mapTmdbPerson(tmdbPerson): PersonInsert` — `gender` (0/1/2/3 TMDB) → enum `genre` interne, `place_of_birth` → résolution pays (approximative)
- [x] `mapTmdbSeason(tmdbSeason, titleId): SeasonInsert`
- [x] `mapTmdbEpisode(tmdbEpisode, seasonId): EpisodeInsert`
- [x] `mapTmdbEpisodeCredits(tmdbEpisodeCredits, episodeId): EpisodeCreditInsert[]`
- [x] `mapTmdbPersonExternalIds(tmdbExternalIds): { imdb_id, wikidata_id }`

### 2.3 Orchestration / import (module `tmdb-sync`, exécuté par le worker)
- [x] `importTitleByTmdbId(tmdbId, type)` — upsert titre + genres + pays + credits + saisons/épisodes + log
- [x] `importPersonByTmdbId(tmdbId)` — upsert personne + résolution wikidata_id → wiki_url
- [x] `importSeasonsForSerie(titleId)` — upsert saisons + épisodes pour une série
- [x] `importEpisodeGuestCredits(episodeId, tmdbId, season, episode)` — guest stars/crew épisode
- [x] `refreshTitleData(titleId)` — re-fetch périodique (note, statut, next_episode)
- [x] `refreshPersonData(personId)` — rafraîchissement bio/photo/wiki_url
- [x] `dailySyncNewEpisodes()` — cron quotidien : refresh titres en cours + notifications
- [x] `weeklyResyncChanges(startDate, endDate)` — cron hebdo via getChanges
- [x] `bootstrapRecommendationsFromTmdb(titleId)` — pré-remplit title_recommendations via TMDB

### 2.4 File de jobs (BullMQ + Redis)
- [ ] Queue `tmdb-import` : jobs `import-title`, `import-seasons`, `refresh-title`
- [ ] Queue `tmdb-cron` : jobs planifiés `daily-sync-new-episodes`, `weekly-resync-changes`, `refresh-materialized-views`
- [ ] Concurrency limitée (ex: 5 jobs parallèles max) pour respecter le rate limit TMDB
- [ ] Dashboard de monitoring (Bull Board) pour debug en dev

### 2.5 Gestion des erreurs / robustesse
- [x] Codes d'erreur TMDB gérés explicitement
- [x] Idempotence via upserts basés sur `tmdb_id` (contrainte UNIQUE)
- [ ] Tests avec mocks HTTP (nock/msw) sur les réponses TMDB

---

## Phase 3 — API backend cœur (endpoints CRUD)

- [x] Module `auth` : register, login (JWT access+refresh), hash bcrypt, guards NestJS
- [x] Module `users` : profil, avatar
- [x] Module `titles` : recherche (proxy TMDB + résultats déjà en local mergés), détail titre, déclenchement d'import si absent de la base
- [x] Module `people` : détail personne + filmographie (via `credits`)
- [x] Module `seasons-episodes` : lecture, vue par saison
- [x] Module `credits` : exposé en sous-ressource de `titles`

Convention : chaque module NestJS = module / controller / service / dto, connecté à @emdb/db (Prisma) et, quand nécessaire, à tmdb-client / tmdb-sync (Phase 2).

### 3.0 Socle transverse (préalable à tous les modules)
- [x] Dépendances : class-validator, class-transformer, @nestjs/jwt, @nestjs/passport, passport, passport-jwt, bcrypt
- [x] `main.ts` : `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`
- [ ] `main.ts` : configurer Swagger (@nestjs/swagger déjà présent — DocumentBuilder + SwaggerModule.setup('/docs', app, document))
- [x] `PrismaModule` : wrapper NestJS global autour du singleton prisma
- [x] Filtre d'exception global (`PrismaExceptionFilter`) pour P2002 → 409, P2025 → 404
- [ ] DTOs communs : `PaginationDto { page, limit }`, `PaginatedResult<T> { data, total, page, limit }`

### 3.1 Module auth
- [x] POST /auth/register — RegisterDto { email, password, pseudo } → hash bcrypt, retourne { user, accessToken, refreshToken }
- [x] POST /auth/login — LoginDto { email, password } → vérifie hash, retourne tokens
- [x] POST /auth/refresh — RefreshDto { refreshToken } → vérifie signature, émet nouvel access token
- [x] POST /auth/logout — invalidation côté client (stateless JWT)
- [x] GET /auth/me — utilisateur courant depuis le JWT
- [x] JwtAuthGuard (Passport) appliqué globalement, sauf /auth/register, /auth/login, /auth/refresh, /health
- [x] Décorateur @CurrentUser() pour extraire req.user

### 3.2 Module users
- [x] GET /users/me — profil complet
- [x] PATCH /users/me — UpdateProfileDto { pseudo?, avatar_url? }
- [x] POST /users/me/avatar — upload multer, validation MIME + 5 Mo
- [x] GET /users/search?query= — recherche par pseudo/email
- [x] DELETE /users/me — suppression compte (cascade FK)

### 3.3 Module titles
- [x] GET /titles/search?q=&type=film|serie — TMDB + fusion locale
- [x] GET /titles/tmdb/:tmdbId — get or import synchrone
- [x] GET /titles/:id — détail complet (genres, pays, studios, saisons)
- [x] GET /titles — liste paginée avec filtres (type, genre_id, country_id, is_animation, note_imdb_min, tri)
- [x] GET /titles/:id/recommendations — locale TMDB fallback
- [x] PATCH /titles/:id/refresh — force refresh TMDB
- [x] DELETE /titles/:id — suppression si orphelin

### 3.4 Module people
- [x] GET /people/search?q= — TMDB + fusion locale
- [x] GET /people/tmdb/:tmdbId — get or import
- [x] GET /people/:id — détail complet (bio, photo, wiki_url, pays)
- [x] GET /people/:id/filmography — credits → titles groupés par rôle
- [x] GET /people/:id/credits — alias de filmography
- [x] GET /people/:id/recommendations — person_recommendations
- [x] PATCH /people/:id/refresh — refresh TMDB

### 3.5 Module seasons-episodes
- [x] GET /titles/:titleId/seasons — liste des saisons avec nombre d'épisodes
- [x] GET /titles/:titleId/seasons/:numero — détail saison + épisodes
- [x] GET /episodes/:id — détail épisode avec saison parente
- [x] GET /episodes/:id/credits — credits spécifiques épisode groupés par rôle

### 3.6 Module credits
- [x] GET /titles/:titleId/credits — cast/crew groupés par rôle

---

## Phase 4 — Fonctionnalités utilisateur (détaillée)

La Phase 4 implémente les fonctionnalités liées à un utilisateur connecté : visionnage, notation, listes personnelles, suivi de séries et calendrier des épisodes non vus.

Découpage en 4 sous-phases indépendantes (ordre recommandé par dépendances croissantes) :

### 4.1 Module `watches` — user_watches + user_follows_serie + calendrier
  *Dépend de :* auth, titles, seasons-episodes (Phase 3)
  *Fonctions PL/pgSQL utilisées :* `fn_progress_serie`, `fn_episodes_non_vus` (appel via `$queryRaw`)
  *Note :* `user_follows_serie` (suivi de séries) inclus dans ce module plutôt qu'en sous-phase séparée, car le calendrier et la progression en dépendent directement.

- [ ] `POST /watches` — CreateWatchDto { title_id?, episode_id?, date_vue? } — marquer vu
- [ ] `DELETE /watches/:id` — supprimer un watch
- [ ] `GET /watches` — liste paginée+filtres (type, date_from, date_to, title_id)
- [ ] `GET /titles/:titleId/progress` — progression série (fn_progress_serie)
- [ ] `GET /calendar` — calendrier épisodes non vus (fn_episodes_non_vus)
- [ ] `POST /follows` — FollowSerieDto { title_id } — suivre une série
- [ ] `DELETE /follows/:titleId` — ne plus suivre
- [ ] `GET /follows` — liste des séries suivies

### 4.2 Module `ratings` — user_ratings
  *Dépend de :* auth, titles

- [ ] `PUT /ratings` — UpsertRatingDto { title_id?, episode_id?, note_perso? (0-10), commentaire? }
  - Validation : note_perso optionnelle (nullable), commentaire optionnel (string)
  - Contrainte unique : UNIQUE(user_id, title_id) et UNIQUE(user_id, episode_id) gérée par Prisma → P2002 catch pour upsert
  - Si title_id fourni avec un rating existant → UPDATE ; sinon CREATE
  - Même logique pour episode_id
  - Le trigger `trg_user_ratings_updated_at` met à jour updated_at automatiquement
- [ ] `DELETE /ratings/:id` — supprime une note (vérifie appartenance)
- [ ] `GET /ratings` — liste des notes de l'utilisateur, paginée, avec filtre par type (film/serie)
- [ ] `GET /titles/:id/ratings` — ratings publics d'un titre (moyenne, répartition)

Fonctions RatingsService :

upsertRating(userId, dto)
deleteRating(id, userId)
listUserRatings(userId, filters, pagination)
getTitleRatingsSummary(titleId) — moyenne, count, répartition par note

### 4.3 Module `lists` — user_lists + list_items + list_shares
  *Dépend de :* auth, users (pour le partage), titles
  *Gap applicatif :* `list_items.position` pas de contrainte d'unicité → gestion soft dans le service (auto-incrément par défaut, réordonnancement explicite via PATCH)

#### user_lists
- [ ] `POST /lists` — CreateListDto { nom, type (watchlist|favoris|custom), description? }
- [ ] `GET /lists` — liste des listes de l'utilisateur connecté
- [ ] `GET /lists/:id` — détail d'une liste avec ses items (titles)
- [ ] `PATCH /lists/:id` — UpdateListDto { nom?, description? }
- [ ] `DELETE /lists/:id` — suppression (cascade sur list_items et list_shares)

#### list_items
- [ ] `POST /lists/:listId/items` — AddItemDto { title_id } — ajoute un titre à la liste
  - position : auto-incrément (max(position) + 1 dans la liste)
- [ ] `DELETE /lists/:listId/items/:titleId` — retire un titre de la liste
- [ ] `PATCH /lists/:listId/items/reorder` — ReorderDto { items: [{ title_id, position }] } — réordonnancement batch
  - Met à jour la position de chaque item dans une transaction

#### list_shares
- [ ] `POST /lists/:listId/shares` — ShareListDto { shared_with_user_id, permission (lecture|edition) }
- [ ] `GET /lists/:listId/shares` — liste des partages
- [ ] `DELETE /lists/:listId/shares/:sharedWithUserId` — retire un partage
- [ ] `GET /shared-lists` — listes partagées avec l'utilisateur connecté (lecture seule si permission=lecture)

Fonctions ListsService / ListItemsService / ListSharesService :

createList(userId, dto)
getUserLists(userId)
getListDetail(listId, userId) — vérifie accès (propriétaire ou partagé)
updateList(listId, userId, dto)
deleteList(listId, userId)
addItem(listId, userId, titleId)
removeItem(listId, userId, titleId)
reorderItems(listId, userId, dto)
shareList(listId, userId, dto)
getShares(listId, userId)
removeShare(listId, userId, sharedWithUserId)
getSharedLists(userId)

### 4.4 Module `follows` — user_follows_serie
  *Dépend de :* auth, titles
  *Contrainte :* `chk_follow_is_serie` est un placeholder CHECK(true) — la validation "ce titre est bien une série" doit être faite applicativement
  *Implémentation :* Intégré dans le module `watches` (couplage fort avec calendrier et progression)

- [x] `POST /follows` — FollowSerieDto { title_id } — suivre une série
  - Vérification applicative : le titre doit être de type 'serie'
  - Doublon géré par contrainte UNIQUE(user_id, title_id)
- [x] `DELETE /follows/:titleId` — ne plus suivre une série
- [x] `GET /follows` — liste des séries suivies par l'utilisateur

**Fichiers impliqués** :
- `apps/api/src/watches/watches.controller.ts` (endpoints)
- `apps/api/src/watches/watches.service.ts` (logique métier)
- `apps/api/src/watches/dto/follow-serie.dto.ts` (DTO)
- `apps/api/src/watches/watches.service.spec.ts` (tests unitaires)

Fonctions FollowsService (dans WatchesService) :

- [x] `follow(userId, titleId)` — Suivre une série (validation type + création)
- [x] `unfollow(userId, titleId)` — Ne plus suivre (vérification existence)
- [x] `getFollowedSeries(userId)` — Lister toutes les séries suivies

**Tests unitaires** : ✅ 7/7 tests passés (100% couverture)

---

## Ordre d'exécution recommandé dans la Phase 4

1. **Phase 4.1** (watches) — le plus indépendant, débloque le calendrier
2. **Phase 4.2** (ratings) — indépendant de watches
3. **Phase 4.4** (follows) — indépendant, nécessaire pour le calendrier watches
4. **Phase 4.3** (lists) — le plus gros, nécessite les autres pour bien tester

---

## Phase 5 — Recommandations batch (algorithme de similarité maison)

Découpage en 3 sous-phases :

### 5.1 Algorithme de similarité + script de calcul (`packages/recommender`)
  *Dépend de :* titles, genres, credits, people (Phase 3), title_recommendations, person_recommendations (schéma)
  *Status: ✅ Implémenté*

  **Algorithme retenu :** Similarité par Jaccard pondéré :
  - Genres partagés : poids 0.6 (Jaccard sur title_genres)
  - Acteurs partagés : poids 0.3 (Jaccard sur credits avec role='acteur', top 10 par ordre)
  - Réalisateurs partagés : poids 0.1 (Jaccard sur credits avec role='realisateur')
  - Score final = 0.6 × genre_jaccard + 0.3 × actor_jaccard + 0.1 × director_jaccard
  - Normalisé entre 0 et 1, stocké dans score DECIMAL(5,4)

  **Nouveau package :** `packages/recommender/`
  - Dépend de `@emdb/db` (Prisma) uniquement (pas de dépendance TMDB)

  - [x] `computeTitleRecommendations()` : calcule les top 10 titres similaires pour chaque titre
    1. Pour chaque titre, charger ses genres (`title_genres`) et ses acteurs/réalisateurs (`credits` avec `roles`)
    2. Pour chaque paire de titres (batch par lot de 100 titres pour éviter OOM), calculer le score Jaccard pondéré
    3. Insérer les top 10 dans `title_recommendations` (batch upsert via `skipDuplicates`)
    4. Nettoyer les anciennes recommandations avant insert (DELETE + INSERT dans une transaction)

  - [x] `computePersonRecommendations()` : calcule les top 10 personnes similaires pour chaque personne
    1. Critère : personnes ayant travaillé ensemble sur les mêmes titres (credits partagés)
    2. Pondération : nombre de credits partagés / total credits (Jaccard sur credits)
    3. Bonus si même genre (homme/femme) : +0.1
    4. Top 10 par score, stocké dans `person_recommendations`

  - [x] Script exécutable `packages/recommender/scripts/run-recommendations.ts`
    - Option `--mode=all` (titles + people), `--mode=titles`, `--mode=people`
    - Option `--batch=100` pour configurer la taille des lots
    - Option `--title-id=xxx` pour calculer pour un seul titre (utile en dev)
    - Logging : console.table des 3 meilleurs scores par titre/personne

  **Performance attendue :**
  - Pour N titres, complexité O(N² × (genres + credits)). Avec 10 000 titres et ~1000 personnes :
    - `computeTitleRecommendations` : ~quelques minutes (batch de 100)
    - `computePersonRecommendations` : ~30 secondes
  - Optimisation future possible : filtrer les paires sans genre commun (similarité = 0 automatique)

  **Fichiers créés :**
  - `packages/recommender/src/jaccard.ts` - Utilitaires Jaccard
  - `packages/recommender/src/recommender.ts` - Algorithme principal
  - `packages/recommender/src/index.ts` - Exports
  - `packages/recommender/src/recommender.spec.ts` - 12 tests unitaires
  - `packages/recommender/scripts/run-recommendations.ts` - CLI
  - `packages/recommender/package.json` - Configuration npm
  - `packages/recommender/tsconfig.json` - Configuration TypeScript

  **Tests :** ✅ 12/12 tests unitaires passés

### 5.2 Module API + intégration worker
  *Dépend de :* Phase 5.1 (algorithme), auth, admin

  - [ ] Endpoint `POST /admin/compute-recommendations` — déclenchement manuel
    - Body : `{ mode?: 'titles' | 'people' | 'all' }`
    - Auth : JWT + rôle admin (vérification simple via un flag ou email fixe)
    - Execution synchrone ou via BullMQ selon la latence
    - Retour : `{ success: true, titles_computed: number, people_computed: number }`

  - [ ] **BullMQ** : Queue `recommendations` avec job `compute-recommendations`
    - Concurrency : 1 (calcul lourd, pas parallélisable sans risque de conflit)
    - Timeout : 30 minutes (évite le kill du worker pour les longs calculs)

  - [ ] **Cron mensuel** : job planifié `compute-recommendations-cron`
    - Exécuté le 1er de chaque mois à 03:00
    - Mode 'all'
    - Notification en cas d'échec (log + métrique)

  - [ ] Module API `recommender` dans NestJS (optionnel si on veut exposer des stats)
    - `GET /admin/recommendations/stats` — statistiques : nombre total de recommandations calculées, date du dernier run, durée du dernier run

### 5.3 Fallback TMDB pour person_recommendations
  *Dépend de :* Phase 2.3 (tmdb-sync), Phase 5.1 (algorithme maison)

  - [ ] `bootstrapPersonRecommendationsFromTmdb(personId)` — symétrique de `bootstrapRecommendationsFromTmdb` pour les titres
    - Utilise `getPersonCombinedCredits` pour trouver les personnes avec qui cette personne a travaillé
    - Calcule un score basé sur le nombre de collaborations

  - [ ] Fallback dans `GET /people/:id/recommendations` : si `person_recommendations` est vide, appeler TMDB
    - Déjà implémenté pour les titres dans Phase 3.3, à étendre aux personnes

---

## Ordre d'exécution recommandé (Phase 5)

1. **Phase 5.1** — algorithme + script (le cœur, testable sans API)
2. **Phase 5.2** — endpoint de déclenchement + worker (nécessite 5.1)
3. **Phase 5.3** — fallback TMDB (indépendant / peut être fait en parallèle de 5.2)

---

## Phase 6 — Dataviz (lecture des vues matérialisées de la Phase 1.4)

La Phase 6 expose les 8 vues matérialisées de la Phase 1.4 via une API REST.
Toute la logique lourde est déjà dans les `mv_*` — l'API ne fait que filtrer/formater.

Découpage en 2 sous-phases :

### 6.1 Module API `dataviz` — endpoints NestJS
*Dépend de :* Phase 1.4 (vues matérialisées + wrappers dans `packages/db/src/functions.ts`), auth (JWT)

- [ ] `GET /dataviz/watch-time?groupBy=genre|period|country|animation&yearFrom=&yearTo=`
  - Auth : JWT requis (données personnelles)
  - Paramètre `groupBy` required (enum)
  - Paramètres optionnels `yearFrom`/`yearTo` (integer, 1900-2100)
  - Vues `period` : filtre SQL `EXTRACT(YEAR FROM periode_semaine) BETWEEN yearFrom AND yearTo`
  - Vues `genre`/`country`/`animation` : sous-requête `EXISTS` sur `user_watches` filtrée par année
  - Tri par période/critère

- [ ] `GET /dataviz/watch-count?groupBy=genre|period|country|animation&yearFrom=&yearTo=`
  - Même logique que watch-time, mais lit les vues `mv_watch_count_*`

- **Structure :**
  ```
  apps/api/src/dataviz/
  ├── dataviz.module.ts
  ├── dataviz.controller.ts
  ├── dataviz.service.ts
  ├── dto/
  │   ├── watch-time-query.dto.ts
  │   └── watch-count-query.dto.ts
  └── dataviz.service.spec.ts
  ```

- **Fonctions `DatavizService` :**
  - `getWatchTime(userId, query)` — dispatche selon `groupBy` vers la MV correspondante
  - `getWatchCount(userId, query)` — idem pour les vues count
  - Toute la logique SQL utilise `prisma.$queryRawUnsafe` (les MV ne sont pas dans Prisma)

### 6.2 Endpoint admin + refresh BullMQ
*Dépend de :* Phase 6.1 (module API), Phase 2.4 (BullMQ), Phase 1.4 (refresh script)

- [ ] `POST /admin/refresh-materialized-views` — déclenchement manuel du refresh
  - Auth : JWT + admin (email fixe dans `ADMIN_EMAILS` via `.env`)
  - Exécution via BullMQ (queue `dataviz`, job `refresh-materialized-views`)
  - Concurrency : 1 (évite les conflits de refresh concurrent)
  - Timeout : 5 minutes
  - Retour : `{ jobId, status: 'queued' }`

- [ ] Cron nocturne (BullMQ) : job planifié chaque nuit à 3h
  - Utilise le même worker que le déclenchement manuel
  - Log en cas d'échec

- [ ] Worker `apps/worker/src/dataviz.worker.ts` :
  - Boucle sur les 8 vues matérialisées
  - `REFRESH MATERIALIZED VIEW CONCURRENTLY` pour chacune
  - Log : succès/échec par vue + durée totale

---

## Phase 7 — Notifications

- [ ] Génération (voir 2.3, `dailySyncNewEpisodes`)
- [ ] Endpoint `GET /notifications` (non lues en priorité, index déjà prévu dans le schéma)
- [ ] Canal de livraison : push mobile (à définir, hors scope backend pur) ou simple polling côté app

---

## Ordre d'exécution recommandé (global)

1. Phase 0 (socle : docker-compose, repo, config)
2. Phase 1.1 (exécuter `db_init_v2.sql` + introspection Prisma)
3. Phase 2 (client TMDB + mapping + import)
4. Phase 3 (API CRUD Prisma)
5. Phase 4 (features utilisateur)
6. Phase 2.3 cron (`dailySyncNewEpisodes`) + Phase 7 (notifications)
7. Phase 5 (recommandations, batch mensuel)
8. Phase 6 (dataviz, lecture des `mv_*` déjà en place depuis la phase 1)

Fichiers de référence : `db_init_v3.sql` (schéma complet avec 8 vues matérialisées), cette roadmap.

---

## 💡 Avis sur la Roadmap (par Mistral Vibe)

### 🔄 Suggestions d'amélioration

#### 1. **Priorisation des phases**
- **Phase 1** : ✅ Complète (schéma + migrations + seeds + fonctions PL/pgSQL)
- **Phase 2** : Dépend de la Phase 1, mais pourrait commencer en parallèle pour le client TMDB
- **Phase 3** : Devrait attendre la fin de la Phase 1 et le début de la Phase 2
- **Suggestion** : Ajouter des dépendances explicites entre phases


#### 3. **Documentation**
- **Manque** : Pas de section dédiée à la documentation utilisateur/API
- **Recommandation** : Ajouter une Phase 9 "Documentation" avec :
  - Swagger/OpenAPI pour l'API
  - Documentation des endpoints
  - Guide de déploiement

#### 4. **Sécurité**
- **Manque** : Pas de mention de :
  - Validation des inputs utilisateur
  - Protection contre les injections SQL (Prisma aide, mais à vérifier)
  - Gestion des erreurs API (middlewares)
  - Authentification/autorisation (JWT déjà prévu)

#### 5. **Optimisations possibles**
- **Cache** : Ajouter Redis cache pour les requêtes fréquentes (déjà mentionné pour TMDB)
- **Pagination** : Prévoir la pagination pour tous les endpoints de liste
- **Rate limiting** : Protéger l'API contre les abus

#### 6. **Évolutivité**
- **Bon** : Architecture monorepo avec workspaces
- **À surveiller** : Performance des vues matérialisées avec beaucoup de données
- **Recommandation** : Prévoir des partitions pour les grandes tables si nécessaire

#### 7. **CI/CD**
- **Actuel** : Workflow de base avec lint + test
- **Améliorations possibles** :
  - Tests automatiques en CI
  - Déploiement automatique (staging/prod)
  - Vérification des migrations avant merge

#### 8. **Monitoring**
- **Manque** : Pas de mention de monitoring en production
- **Recommandation** : Ajouter :
  - Logging structuré
  - Métriques (Prometheus/Grafana)
  - Alertes sur les erreurs critiques

---

## 📊 Résumé des modifications apportées

### Vues Matérialisées (Phase 1.4)
- **Ajoutées** : `mv_watch_count_by_period`, `mv_watch_count_by_country`, `mv_watch_count_by_animation`
- **Total** : 8 vues matérialisées (5 "watch_time" + 3 "watch_count")
- **Script** : `refresh-materialized-views.ts` mis à jour
- **Schéma** : `db_init.sql` passe en v3

### Améliorations CI
- **Corrigé** : Installation de postgresql-client dans le workflow
- **Corrigé** : Utilisation de `env:` pour PGPASSWORD
- **Corrigé** : Changement de répertoire pour les commandes Prisma

### Phase 3 réalisée
- **3.1 Auth** : register, login, refresh, logout, me ✅
- **3.2 Users** : CRUD profil + avatar ✅
- **3.3 Titles** : search, getOrImport, detail, list, recommendations, refresh, delete ✅
- **3.4 People** : search, getOrImport, detail, filmography, credits, recommendations, refresh ✅
- **3.5 Seasons-Episodes** : list seasons, get season, get episode, episode credits ✅
- **3.6 Credits** : title credits groupés par rôle ✅

---

*Dernière mise à jour : 23 juillet 2026*

