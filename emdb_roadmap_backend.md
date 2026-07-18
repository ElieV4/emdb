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

### 1.4 Vues matérialisées (dataviz — déjà créées dans le schéma v2)
- `mv_watch_time_by_period`, `mv_watch_time_by_genre`, `mv_watch_time_by_country`, `mv_watch_time_by_animation`, `mv_watch_count_by_genre`
- [ ] Job worker `refreshMaterializedViews()` : `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_xxx` pour chacune (index UNIQUE déjà en place dans le schéma pour permettre le mode CONCURRENTLY), cron nocturne
- [ ] Si besoin plus tard : ajouter `mv_watch_count_by_period` (symétrique à `mv_watch_count_by_genre` mais par date) — non présent dans v2, à ajouter si le besoin dataviz se confirme

### 1.5 Contraintes de cohérence à vérifier en tests d'intégration
- [ ] `user_ratings` : double `UNIQUE (user_id, title_id)` / `UNIQUE (user_id, episode_id)` — fonctionne car Postgres ignore les `NULL` dans les contraintes unique, mais à couvrir par un test dédié (comportement parfois surprenant)
- [ ] `list_items.position` : pas de contrainte d'unicité par liste → gestion applicative du ré-ordonnancement à prévoir côté module `lists` (phase 4)
- [ ] `user_follows_serie.chk_follow_is_serie` : la contrainte SQL est un placeholder (`CHECK (true)`) — la vraie validation "ce titre est bien de type serie" doit être faite côté application (service layer), Postgres ne peut pas facilement vérifier une valeur d'une autre table dans un CHECK sans trigger dédié ; à ajouter en trigger `BEFORE INSERT` si on veut une garantie dure en base

---

## Phase 2 — Intégration API TMDB (détail à la maille fonction)

### 2.1 Client TMDB (module `tmdb-client`)
- [ ] `tmdbClient.ts` : wrapper HTTP (axios/fetch) avec :
  - base URL `https://api.themoviedb.org/3`
  - auth via header `Authorization: Bearer <TMDB_API_KEY>` (v4) ou `api_key` query param (v3)
  - gestion du rate limit (~50 req/s en pratique, prévoir un `p-limit` ou `Bottleneck` à 40 req/10s)
  - retry avec backoff exponentiel sur 429/5xx (`fetch-retry` ou logique maison)
  - cache Redis en lecture (clé = endpoint+params, TTL configurable, ex: 24h pour les détails, 1h pour les recherches)

- Fonctions bas niveau (1 fonction = 1 endpoint TMDB) :
  - `searchMovie(query: string, year?: number): Promise<TmdbSearchResult[]>`
  - `searchTv(query: string, year?: number): Promise<TmdbSearchResult[]>`
  - `getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails>` (avec `append_to_response=credits,images,videos`)
  - `getTvDetails(tmdbId: number): Promise<TmdbTvDetails>` (avec `append_to_response=credits,images,content_ratings`)
  - `getTvSeason(tmdbId: number, seasonNumber: number): Promise<TmdbSeasonDetails>`
  - `getPersonDetails(personTmdbId: number): Promise<TmdbPersonDetails>`
  - `getPersonCombinedCredits(personTmdbId: number): Promise<TmdbCombinedCredits>`
  - `getConfiguration(): Promise<TmdbConfig>` (pour construire les URLs d'images, base_url + tailles)
  - `getGenreListMovie(): Promise<TmdbGenre[]>`
  - `getGenreListTv(): Promise<TmdbGenre[]>`
  - `getMovieExternalIds(tmdbId): Promise<{imdb_id: string}>` — utile si tu veux croiser avec une note IMDb "brute" séparée de TMDB
  - `getChanges(startDate, endDate): Promise<TmdbChangeItem[]>` — endpoint `/movie/changes` et `/tv/changes`, utile pour ne resynchroniser que ce qui a changé plutôt que tout

### 2.2 Mapping TMDB → modèle interne (module `tmdb-mapper`)
- [ ] `mapTmdbMovieToTitle(tmdbMovie): TitleInsert` — mappe `title/original_title` → `titre_vf/titre_vo`, `release_date` → `date_sortie`, `runtime` → `duree_minutes`, `vote_average` → `note_imdb` (ou champ dédié si tu distingues note TMDB / IMDb réelle), `poster_path` + config → `affiche_url`
- [ ] `mapTmdbTvToTitle(tmdbTv): TitleInsert` — idem + `status` → `statut_serie` (mapping `Returning Series`→`en_cours`, `Ended`/`Canceled`→`terminee`/`annulee`), `next_episode_to_air` → `next_episode_air_date`
- [ ] `mapTmdbGenres(tmdbGenres): GenreInsert[]`
- [ ] `mapTmdbCountries(iso3166List): CountryInsert[]` (ISO fixe, pas de dépendance TMDB pour l'exhaustivité)
- [ ] `mapTmdbCredits(tmdbCredits, titleId): CreditInsert[]` — sépare `cast` (role='acteur', garde `character` → `personnage`, `order` → `ordre`) et `crew` (filtre `job === 'Director'` → role='realisateur', `job === 'Writer'/'Screenplay'` → role='scenariste', reste → 'autre')
- [ ] `mapTmdbPerson(tmdbPerson): PersonInsert` — `gender` (0/1/2/3 TMDB) → enum `genre` interne, `place_of_birth` → résolution pays (approximative, à documenter comme limite)
- [ ] `mapTmdbSeason(tmdbSeason, titleId): SeasonInsert`
- [ ] `mapTmdbEpisode(tmdbEpisode, seasonId): EpisodeInsert`

### 2.3 Orchestration / import (module `tmdb-sync`, exécuté par le worker)
- [ ] `importTitleByTmdbId(tmdbId: number, type: 'film'|'serie'): Promise<Title>`
  1. Vérifie si `titles.tmdb_id` existe déjà (upsert plutôt que doublon)
  2. Appelle `getMovieDetails` ou `getTvDetails`
  3. Upsert genres/countries manquants (`title_genres`, `title_countries`)
  4. Upsert credits → pour chaque credit, `upsertPerson()` (voir 2.3.2) puis insert dans `credits`
  5. Si `type === 'serie'` → déclenche `importSeasonsForSerie(titleId)`
  6. Log dans `tmdb_sync_log`
- [ ] `upsertPerson(tmdbPersonSummary): Promise<Person>` — si la personne n'existe pas en base (par `tmdb_id`), fetch `getPersonDetails` complet, sinon réutilise l'existant (évite un appel API par credit)
- [ ] `importSeasonsForSerie(titleId: string): Promise<void>` — boucle sur les saisons connues via `getTvDetails`, appelle `getTvSeason` pour chacune, upsert `seasons` + `episodes`
- [ ] `refreshTitleData(titleId: string): Promise<void>` — re-fetch périodique (note, statut, next_episode) sans tout ré-importer (évite de re-toucher `credits` à chaque fois)
- [ ] `dailySyncNewEpisodes(): Promise<void>` (cron quotidien) :
  1. Sélectionne les titres `type='serie'` et `statut_serie='en_cours'` suivis (`user_follows_serie`) ou notés/vus
  2. Pour chacun, `refreshTitleData` + `importSeasonsForSerie` si nouvelle saison détectée
  3. Si nouvel épisode détecté avec `date_sortie <= today` → insert `notifications` (type='nouvel_episode') pour chaque `user_id` qui suit ce titre
- [ ] `weeklyResyncChanges(): Promise<void>` (cron hebdo, optionnel/optimisation) : utilise `getChanges` pour ne resynchroniser que les titres modifiés côté TMDB plutôt qu'un refresh complet de toute la base

### 2.4 File de jobs (BullMQ + Redis)
- [ ] Queue `tmdb-import` : jobs `import-title`, `import-seasons`, `refresh-title`
- [ ] Queue `tmdb-cron` : jobs planifiés `daily-sync-new-episodes`, `weekly-resync-changes`, `refresh-materialized-views`
- [ ] Concurrency limitée (ex: 5 jobs parallèles max) pour respecter le rate limit TMDB
- [ ] Dashboard de monitoring (Bull Board) pour debug en dev

### 2.5 Gestion des erreurs / robustesse
- [ ] Codes d'erreur TMDB à gérer explicitement : 401 (clé invalide), 404 (id inconnu → ne pas retry), 429 (rate limit → retry avec `Retry-After`)
- [ ] Idempotence : tous les upserts basés sur `tmdb_id` (contrainte `UNIQUE` déjà en place dans le schéma)
- [ ] Tests avec mocks HTTP (nock/msw) sur les réponses TMDB pour ne jamais dépendre de l'API réelle en CI

---

## Phase 3 — API backend cœur (endpoints CRUD)

*(moins prioritaire à détailler ici selon ta demande, je reste au niveau module — dis-moi si tu veux que je descende aussi à la maille fonction sur cette phase)*

- [ ] Module `auth` : register, login (JWT access+refresh), hash bcrypt, guards NestJS
- [ ] Module `users` : profil, avatar
- [ ] Module `titles` : recherche (proxy TMDB + résultats déjà en local mergés), détail titre, déclenchement d'import si absent de la base
- [ ] Module `people` : détail personne + filmographie (via `credits`)
- [ ] Module `seasons-episodes` : lecture, vue par saison
- [ ] Module `credits` : exposé en sous-ressource de `titles`

---

## Phase 4 — Fonctionnalités utilisateur

- [ ] `user_watches` : marquer vu (titre ou épisode), vue datée par saison via `fn_progress_serie`
- [ ] `user_ratings` : note perso + commentaire, upsert (create ou update selon existence)
- [ ] `user_lists` / `list_items` / `list_shares` : CRUD listes, réordonnancement, partage lecture/édition
- [ ] Calendrier : endpoint basé sur `fn_episodes_non_vus` + `user_follows_serie`, tri par nombre d'épisodes non vus

---

## Phase 5 — Recommandations (batch)

- [ ] Job `computeTitleRecommendations()` : similarité par genres partagés + acteurs/réals partagés (pondération), écrit dans `title_recommendations`
- [ ] Job `computePersonRecommendations()` : personnes ayant travaillé ensemble fréquemment ou genres similaires
- [ ] Cron mensuel (recalcul coûteux, pas temps réel)

---

## Phase 6 — Dataviz (lecture des vues matérialisées de la Phase 1.4)

- [ ] Endpoints `GET /dataviz/watch-time?groupBy=genre|period|country|animation|note`
- [ ] Endpoints `GET /dataviz/watch-count?groupBy=...`
- [ ] Toute la logique lourde est déjà dans les `mv_*` — l'API ne fait que filtrer/formater

---

## Phase 7 — Notifications

- [ ] Génération (voir 2.3, `dailySyncNewEpisodes`)
- [ ] Endpoint `GET /notifications` (non lues en priorité, index déjà prévu dans le schéma)
- [ ] Canal de livraison : push mobile (à définir, hors scope backend pur) ou simple polling côté app

---

## Ordre d'exécution recommandé

1. Phase 0 (socle : docker-compose, repo, config)
2. Phase 1.1 (exécuter `db_init_v2.sql` + introspection Prisma) — schéma déjà validé, pas d'aller-retour attendu ici
3. Phase 2 (client TMDB + mapping + import d'un seul titre en dur, testé manuellement)
4. Phase 3 (API CRUD Prisma, pour consommer les données importées)
5. Phase 4 (features utilisateur : watches, ratings, listes, calendrier via `fn_episodes_non_vus`)
6. Phase 2.3 cron (`dailySyncNewEpisodes`) + Phase 7 (notifications, basées sur `user_follows_serie`)
7. Phase 5 (recommandations, batch mensuel)
8. Phase 6 (dataviz, lecture des `mv_*` déjà en place depuis la phase 1)

Fichiers de référence : `db_init_v2.sql` (schéma complet), cette roadmap.
Dis-moi si tu veux que je détaille Phase 3 au même niveau de granularité (fonction par fonction, endpoint par endpoint).
