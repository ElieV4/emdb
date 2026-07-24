# Roadmap Backend — eMDB (movie/serie tracker)

Basé sur `README.md` et sur `db_init_v2.sql` (schéma finalisé, intégrant les gaps identifiés dès le départ plutôt qu'en rustine).

**Stack retenue** : Node.js + TypeScript + NestJS + **Prisma** + PostgreSQL + Redis + BullMQ.

Répartition Prisma / SQL brut :
- **Prisma** pour ~90% de l'API : tout le CRUD standard (`users`, `titles`, `credits`, `people`, `seasons`, `episodes`, `user_lists`, `notifications`...) → client type-safe généré, migrations gérées via `prisma migrate`.
- **`prisma.$queryRaw` / `$executeRaw`** pour les ~10% de requêtes lourdes ou spécifiques : appel des fonctions PL/pgSQL (`fn_episodes_non_vus`, `fn_progress_serie`), lecture des vues matérialisées dataviz, `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
- Le trigger (`trg_user_ratings_updated_at`) et les vues matérialisées vivent en SQL pur dans une migration Prisma "custom" (Prisma permet d'ajouter du SQL brut dans ses fichiers de migration générés, ou via une migration `prisma migrate dev --create-only` éditée à la main).

---

## Phase 0 — Socle technique (avant tout dev métier)

- [x] Repo : monorepo `apps/api`, `apps/worker` (jobs TMDB), `packages/db` (schéma + migrations partagées)
- [x] Docker Compose : `postgres`, `redis`, `api`, `worker`
- [x] Config env : `.env` (DATABASE_URL, TMDB_API_KEY, TMDB_BASE_URL, REDIS_URL, JWT_SECRET)
- [x] Linter/format (eslint, prettier), tests (jest/vitest), CI (github actions : lint + test + migration dry-run)

---

## Phase 1 — Base de données (détail maximal)

Base = `db_init_v2.sql` (schéma finalisé). Il intègre déjà : `is_animation`, `next_episode_air_date`, `user_follows_serie`, `tmdb_sync_log`, le trigger `updated_at`, les fonctions PL/pgSQL et les vues matérialisées dataviz.

### 1.1 Mise en place initiale
- [x] Exécuter `db_init_v2.sql` sur une base Postgres vierge (locale, via docker-compose)
- [x] `prisma db pull` → génère `schema.prisma` par introspection
- [x] `prisma generate` → client TS type-safe
- [x] Vérifier `pgcrypto` dispo en prod managée
- [x] Seed scripts (idempotents) :
  - `seed_genres.ts` → insère les genres TMDB
  - `seed_countries.ts` → insère la liste ISO 3166-1 alpha-2 complète

### 1.2 Gestion des objets "hors Prisma" (triggers, fonctions, vues matérialisées)
- [x] Garder `db_init_v2.sql` comme unique source de vérité pour ces objets
- [x] Documenter clairement dans le repo (`prisma/README.md`) que `trg_user_ratings_updated_at`, `fn_episodes_non_vus`, `fn_progress_serie` et les 8 `mv_*` sont en SQL pur

### 1.3 Fonctions PL/pgSQL
- [x] `fn_episodes_non_vus(user_id, title_id) RETURNS INT` — appelée via `prisma.$queryRaw` pour le calendrier
- [x] `fn_progress_serie(user_id, title_id) RETURNS TABLE(saison, vus, total)` — appelée via `$queryRaw` pour la page série

### 1.4 Vues matérialisées (dataviz)
- **Vues "watch_time" (durée)** : `mv_watch_time_by_period`, `mv_watch_time_by_genre`, `mv_watch_time_by_country`, `mv_watch_time_by_animation`
- **Vues "watch_count" (compte)** : `mv_watch_count_by_genre`, `mv_watch_count_by_period`, `mv_watch_count_by_country`, `mv_watch_count_by_animation`
- [x] Job worker `refreshMaterializedViews()` : `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_xxx` pour chacune, cron nocturne
- [x] Script `packages/db/scripts/refresh-materialized-views.ts` implémenté et testé

### 1.5 Contraintes de cohérence à vérifier en tests d'intégration
- [x] `user_ratings` : double `UNIQUE (user_id, title_id)` / `UNIQUE (user_id, episode_id)`
- [x] `list_items.position` : pas de contrainte d'unicité par liste → gestion applicative
- [x] `user_follows_serie.chk_follow_is_serie` : validation applicative côté service
- [x] Tests unitaires pour les fonctions PL/pgSQL (via `$queryRaw`)
- [x] Tests d'intégration pour les contraintes de base de données
- [x] Tests E2E pour les workflows critiques

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
- [x] `mapTmdbMovieToTitle(tmdbMovie): TitleInsert`
- [x] `mapTmdbTvToTitle(tmdbTv): TitleInsert`
- [x] `mapTmdbGenres(tmdbGenres): GenreInsert[]`
- [x] `mapTmdbCountries(iso3166List): CountryInsert[]`
- [x] `mapTmdbCredits(tmdbCredits, titleId): CreditInsert[]`
- [x] `mapTmdbPerson(tmdbPerson): PersonInsert`
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
- [x] `bootstrapPersonRecommendationsFromTmdb(personId)` — pré-remplit person_recommendations via TMDB

### 2.4 File de jobs (BullMQ + Redis)
- [x] Queue `tmdb-import` : jobs `import-title`, `import-seasons`, `refresh-title`
- [x] Queue `tmdb-cron` : jobs planifiés `daily-sync-new-episodes`, `weekly-resync-changes`, `refresh-materialized-views`
- [x] Concurrency limitée (ex: 5 jobs parallèles max) pour respecter le rate limit TMDB
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
- [x] GET /people/:id/recommendations — person_recommendations (fallback TMDB si vide)
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

- [x] `POST /watches` — CreateWatchDto { title_id?, episode_id?, date_vue? } — marquer vu
- [x] `DELETE /watches/:id` — supprimer un watch
- [x] `GET /watches` — liste paginée+filtres (type, date_from, date_to, title_id)
- [x] `GET /titles/:titleId/progress` — progression série (fn_progress_serie)
- [x] `GET /calendar` — calendrier épisodes non vus (fn_episodes_non_vus)
- [x] `POST /follows` — FollowSerieDto { title_id } — suivre une série
- [x] `DELETE /follows/:titleId` — ne plus suivre
- [x] `GET /follows` — liste des séries suivies

### 4.2 Module `ratings` — user_ratings
  *Dépend de :* auth, titles

- [x] `PUT /ratings` — UpsertRatingDto { title_id?, episode_id?, note_perso? (0-10), commentaire? }
- [x] `DELETE /ratings/:id` — supprime une note (vérifie appartenance)
- [x] `GET /ratings` — liste des notes de l'utilisateur, paginée, avec filtre par type (film/serie)
- [x] `GET /titles/:id/ratings` — ratings publics d'un titre (moyenne, répartition)

### 4.3 Module `lists` — user_lists + list_items + list_shares
  *Dépend de :* auth, users (pour le partage), titles

- [x] `POST /lists` — CreateListDto { nom, type (watchlist|favoris|custom), description? }
- [x] `GET /lists` — liste des listes de l'utilisateur connecté
- [x] `GET /lists/:id` — détail d'une liste avec ses items (titles)
- [x] `PATCH /lists/:id` — UpdateListDto { nom?, description? }
- [x] `DELETE /lists/:id` — suppression (cascade sur list_items et list_shares)
- [x] `POST /lists/:listId/items` — AddItemDto { title_id } — ajoute un titre à la liste
- [x] `DELETE /lists/:listId/items/:titleId` — retire un titre de la liste
- [x] `PATCH /lists/:listId/items/reorder` — ReorderDto { items: [{ title_id, position }] } — réordonnancement batch
- [x] `POST /lists/:listId/shares` — ShareListDto { shared_with_user_id, permission (lecture|edition) }
- [x] `GET /lists/:listId/shares` — liste des partages
- [x] `DELETE /lists/:listId/shares/:sharedWithUserId` — retire un partage
- [x] `GET /shared-lists` — listes partagées avec l'utilisateur connecté

### 4.4 Module `follows` — user_follows_serie
  *Dépend de :* auth, titles
  *Implémentation :* Intégré dans le module `watches` (couplage fort avec calendrier et progression)

- [x] `POST /follows` — FollowSerieDto { title_id } — suivre une série
- [x] `DELETE /follows/:titleId` — ne plus suivre une série
- [x] `GET /follows` — liste des séries suivies par l'utilisateur

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

  - [x] `computeTitleRecommendations()` : calcule les top 10 titres similaires pour chaque titre
  - [x] `computePersonRecommendations()` : calcule les top 10 personnes similaires pour chaque personne
  - [x] Script exécutable `packages/recommender/scripts/run-recommendations.ts`
  - [x] 12/12 tests unitaires passés

### 5.2 Module API + intégration worker
  *Dépend de :* Phase 5.1 (algorithme), auth, admin

  - [x] Endpoint `POST /admin/compute-recommendations` — déclenchement manuel
  - [x] BullMQ : Queue `recommendations` avec job `compute-recommendations`
  - [x] Cron mensuel : job planifié `compute-recommendations-cron` (1er du mois à 03:00)
  - [x] Module API `recommender` dans NestJS (3 endpoints)

### 5.3 Fallback TMDB pour person_recommendations
  *Dépend de :* Phase 2.3 (tmdb-sync), Phase 5.1 (algorithme maison)

  - [x] `bootstrapPersonRecommendationsFromTmdb(personId)` — symétrique de `bootstrapRecommendationsFromTmdb` pour les titres
  - [x] Fallback dans `GET /people/:id/recommendations` : si `person_recommendations` est vide, appeler TMDB

---

## Phase 6 — Dataviz (lecture des vues matérialisées de la Phase 1.4)

Découpage en 2 sous-phases :

### 6.1 Module API `dataviz` — endpoints NestJS
*Dépend de :* Phase 1.4 (vues matérialisées + wrappers dans `packages/db/src/functions.ts`), auth (JWT)

- [x] `GET /dataviz/watch-time?groupBy=genre|period|country|animation&yearFrom=&yearTo=`
- [x] `GET /dataviz/watch-count?groupBy=genre|period|country|animation&yearFrom=&yearTo=`

### 6.2 Endpoint admin + refresh BullMQ
*Dépend de :* Phase 6.1 (module API), Phase 2.4 (BullMQ), Phase 1.4 (refresh script)

- [x] `POST /admin/refresh-materialized-views` — déclenchement manuel du refresh
- [x] Cron nocturne (BullMQ) : job planifié chaque nuit à 3h
- [x] Worker `apps/worker/src/worker.ts` : boucle sur les 8 vues matérialisées

---

## Phase 7 — Notifications

La Phase 7 implémente le système de notifications utilisateur : génération automatique lors de la détection de nouveaux épisodes, API de consultation, marquage comme lu, et compteur de notifications non lues.

Découpage en 3 sous-phases (ordre recommandé par dépendances croissantes) :

### 7.1 Module API `notifications` — endpoints NestJS
  *Dépend de :* auth (JWT), Phase 1 (table `notifications` dans le schéma Prisma)
  *Status: ❌ À implémenter*

  **Contexte :** La table `notifications` existe déjà dans le schéma Prisma (modèle `notifications` avec `id`, `user_id`, `episode_id?`, `type`, `lu`, `created_at`). Le delegate `prisma.notifications` est déjà exposé dans `PrismaService`. Il manque le module NestJS et les endpoints API.

  **Endpoints :**

  | Method | Path | Auth | DTO | Description |
  |--------|------|------|-----|-------------|
  | `GET` | `/notifications` | ✅ JWT | `ListNotificationsFilterDto` | Liste des notifications (non lues en priorité, paginée) |
  | `PATCH` | `/notifications/:id/read` | ✅ JWT | — | Marquer une notification comme lue |
  | `PATCH` | `/notifications/read-all` | ✅ JWT | — | Marquer toutes les notifications comme lues |
  | `GET` | `/notifications/unread-count` | ✅ JWT | — | Compteur de notifications non lues |

  **DTOs :**
  ```typescript
  // ListNotificationsFilterDto (extends PaginationDto)
  class ListNotificationsFilterDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;
  }
  ```

  **Fonctions NotificationsService :**
  ```typescript
  class NotificationsService {
    listNotifications(userId: string, filters: ListNotificationsFilterDto): Promise<PaginatedNotifications>
    markAsRead(notificationId: string, userId: string): Promise<void>
    markAllAsRead(userId: string): Promise<void>
    getUnreadCount(userId: string): Promise<number>
  }
  ```

  **Types de retour :**
  ```typescript
  interface PaginatedNotifications {
    data: Array<{
      id: string;
      type: string;
      lu: boolean;
      created_at: Date;
      episode?: {
        id: string;
        numero: number;
        titre: string | null;
        season?: { numero: number };
        titles?: { id: string; titre_vo: string; affiche_url: string | null };
      };
    }>;
    total: number;
    page: number;
    limit: number;
  }
  ```

  **Structure :**
  ```
  apps/api/src/notifications/
  ├── notifications.module.ts
  ├── notifications.controller.ts
  ├── notifications.service.ts
  ├── dto/
  │   └── list-notifications-filter.dto.ts
  └── notifications.service.spec.ts
  ```

  **Tests :**
  - `listNotifications` : retourne la liste paginée, triée par non lues en priorité
  - `listNotifications` : retourne un tableau vide si aucune notification
  - `markAsRead` : marque une notification comme lue
  - `markAsRead` : lève NotFound si la notification n'existe pas
  - `markAsRead` : lève Forbidden si la notification appartient à un autre user
  - `markAllAsRead` : marque toutes les notifications de l'utilisateur comme lues
  - `getUnreadCount` : retourne le nombre de notifications non lues

---

### 7.2 Génération des notifications (worker + tmdb-sync)
  *Dépend de :* Phase 7.1 (module API), Phase 2.3 (tmdb-sync), Phase 4.1 (watches/follows)
  *Status: ❌ À implémenter*

  **Contexte :** La fonction `dailySyncNewEpisodes()` existe déjà dans `packages/tmdb-sync/src/index.ts` et rafraîchit les titres en cours. Elle doit être enrichie pour créer des notifications dans la table `notifications` lorsqu'un nouvel épisode est détecté.

  **Algorithme de génération :**

  ```typescript
  async function generateNewEpisodeNotifications(): Promise<number> {
    // 1. Récupérer tous les titres de type 'serie' avec next_episode_air_date <= aujourd'hui
    //    et dont le statut est 'en_cours' ou 'retourne'
    const series = await prisma.titles.findMany({
      where: {
        type: 'serie',
        statut_serie: { in: ['en_cours', 'retourne'] },
        next_episode_air_date: { lte: new Date() },
      },
      select: { id: true, titre_vo: true },
    });

    let totalNotifications = 0;

    for (const serie of series) {
      // 2. Pour chaque série, trouver les utilisateurs qui la suivent
      const followers = await prisma.user_follows_serie.findMany({
        where: { title_id: serie.id },
        select: { user_id: true },
      });

      if (followers.length === 0) continue;

      // 3. Trouver le dernier épisode non encore notifié
      //    (on vérifie qu'une notification n'existe pas déjà pour cet épisode)
      const latestEpisode = await prisma.episodes.findFirst({
        where: {
          season: { title_id: serie.id },
          date_sortie: { lte: new Date() },
        },
        orderBy: { date_sortie: 'desc' },
        select: { id: true, numero: true, titre: true },
      });

      if (!latestEpisode) continue;

      // 4. Vérifier si une notification existe déjà pour cet épisode
      const existingNotif = await prisma.notifications.findFirst({
        where: {
          episode_id: latestEpisode.id,
          type: 'new_episode',
        },
      });

      if (existingNotif) continue; // Déjà notifié

      // 5. Créer une notification pour chaque follower
      const notifications = followers.map((f) => ({
        user_id: f.user_id,
        episode_id: latestEpisode.id,
        type: 'new_episode',
        lu: false,
      }));

      await prisma.notifications.createMany({ data: notifications });
      totalNotifications += notifications.length;
    }

    return totalNotifications;
  }
  ```

  **Intégration dans le worker :**
  - La fonction `dailySyncNewEpisodes()` dans `packages/tmdb-sync` doit être enrichie pour appeler `generateNewEpisodeNotifications()` après le refresh des titres
  - Le job `daily-sync-new-episodes` dans `apps/worker/src/worker.ts` doit être mis à jour pour inclure la génération de notifications
  - Un nouveau job `generate-notifications` peut être ajouté à la queue `tmdb-cron` pour une exécution séparée (recommandé)

  **Types de notifications :**
  | Type | Déclencheur | Contenu |
  |------|-------------|---------|
  | `new_episode` | Nouvel épisode d'une série suivie | "Nouvel épisode de [Série] : S[XX]E[YY] - [Titre]" |
  | `season_premiere` | Première d'une nouvelle saison | "La saison [N] de [Série] est disponible" |
  | `series_return` | Retour d'une série en pause | "[Série] est de retour ! Nouvel épisode disponible" |

  **Fichiers modifiés :**
  - `packages/tmdb-sync/src/index.ts` — Ajout de `generateNewEpisodeNotifications()`
  - `apps/worker/src/worker.ts` — Intégration dans le job `daily-sync-new-episodes`
  - `packages/tmdb-sync/src/index.spec.ts` — Tests de la génération

  **Tests :**
  - `generateNewEpisodeNotifications` : crée des notifications pour les followers
  - `generateNewEpisodeNotifications` : ne crée pas de doublon (vérification existante)
  - `generateNewEpisodeNotifications` : ignore les séries sans followers
  - `generateNewEpisodeNotifications` : ignore les séries sans nouvel épisode
  - `dailySyncNewEpisodes` : intègre la génération de notifications après le refresh

---

### 7.3 Nettoyage et maintenance des notifications
  *Dépend de :* Phase 7.1 (module API), Phase 7.2 (génération)
  *Status: ❌ À implémenter*

  **Contexte :** Les notifications s'accumulent dans la table `notifications`. Sans nettoyage, la table peut devenir volumineuse. Un job de maintenance périodique est nécessaire.

  **Fonctionnalités :**

  - **Cron hebdomadaire** : suppression des notifications lues de plus de 30 jours
    ```typescript
    async function cleanOldNotifications(): Promise<number> {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const result = await prisma.notifications.deleteMany({
        where: {
          lu: true,
          created_at: { lt: cutoff },
        },
      });

      return result.count;
    }
    ```

  - **Cron mensuel** : suppression des notifications non lues de plus de 90 jours (obsolètes)
    ```typescript
    async function cleanStaleNotifications(): Promise<number> {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);

      const result = await prisma.notifications.deleteMany({
        where: {
          lu: false,
          created_at: { lt: cutoff },
        },
      });

      return result.count;
    }
    ```

  - **Job BullMQ** : `clean-notifications` dans la queue `tmdb-cron`
    - Exécution hebdomadaire (nettoyage) + mensuelle (obsolètes)
    - Log : nombre de notifications supprimées

  **Fichiers modifiés :**
  - `apps/worker/src/worker.ts` — Ajout du job `clean-notifications` dans le cron worker
  - `apps/worker/src/worker.spec.ts` — Tests du job de nettoyage

  **Tests :**
  - `cleanOldNotifications` : supprime les notifications lues de plus de 30 jours
  - `cleanOldNotifications` : ne supprime pas les notifications récentes
  - `cleanStaleNotifications` : supprime les notifications non lues de plus de 90 jours
  - `cleanStaleNotifications` : ne supprime pas les notifications récentes non lues

---

## Ordre d'exécution recommandé (Phase 7)

1. **Phase 7.1** — Module API notifications (le plus indépendant, débloque l'interface utilisateur)
2. **Phase 7.2** — Génération des notifications (nécessite 7.1 pour le modèle, mais peut être fait en parallèle)
3. **Phase 7.3** — Nettoyage et maintenance (dépend de 7.1 et 7.2, peut être fait en dernier)

---

## Ordre d'exécution recommandé (global)

1. Phase 0 (socle : docker-compose, repo, config) ✅
2. Phase 1.1 (exécuter `db_init_v2.sql` + introspection Prisma) ✅
3. Phase 2 (client TMDB + mapping + import) ✅
4. Phase 3 (API CRUD Prisma) ✅
5. Phase 4 (features utilisateur) ✅
6. Phase 5 (recommandations, batch mensuel) ✅
7. Phase 6 (dataviz, lecture des `mv_*` déjà en place depuis la phase 1) ✅
8. **Phase 7 (notifications)** ❌ À implémenter

Fichiers de référence : `db_init_v3.sql` (schéma complet avec 8 vues matérialisées), cette roadmap.

---

## 📊 Résumé des modifications apportées

### Phase 7 — Notifications (Nouvelle)
- **7.1** : Module API NestJS `notifications` (4 endpoints)
- **7.2** : Génération automatique dans le worker + tmdb-sync
- **7.3** : Nettoyage et maintenance (cron hebdomadaire/mensuel)

### Phases antérieures (complétées)
- **Phase 0** : Socle technique ✅
- **Phase 1** : Base de données (schéma + MV + fonctions) ✅
- **Phase 2** : Intégration TMDB (client + mapping + sync) ✅
- **Phase 3** : API CRUD Cœur ✅
- **Phase 4** : Fonctionnalités utilisateur ✅
- **Phase 5** : Recommandations (algorithme maison) ✅
- **Phase 6** : Dataviz (vues matérialisées) ✅

---

*Dernière mise à jour : 24 juillet 2026*