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

Fonction à ajouter	Pourquoi
searchPerson(query)	Le README prévoit une "page réal ou acteur" mais la 2.1 ne permet de trouver une personne que via un credit — impossible de chercher directement un acteur
searchMulti(query)	Recherche unifiée films/séries/personnes en une requête (plus adapté à une barre de recherche unique que searchMovie/searchTv séparés)
getTvExternalIds(tmdbId)	Tu as getMovieExternalIds mais pas l'équivalent séries — donc pas d'imdb_id pour les séries
getPersonExternalIds(personTmdbId)	Manque complètement. prisma/README.md dit explicitement que people.wiki_url est "résolu via TMDB external_ids (wikidata_id) + API Wikidata", mais aucune fonction ne récupère ce wikidata_id
getTvEpisodeDetails(tmdbId, season, episode) avec append_to_response=credits	Ton schéma a credits.episode_id (pensé pour les guest stars par épisode), mais rien dans la 2.1 ne va chercher les crédits au niveau épisode — getTvSeason seul ne donne que les épisodes globaux
getMovieImages(tmdbId) / getTvImages(tmdbId) / getPersonImages(personTmdbId)	Pour des galeries d'affiches/photos si tu veux dépasser le simple affiche_url/photo_url unique
getMovieVideos(tmdbId) / getTvVideos(tmdbId)	Bandes-annonces — pas dans le schéma actuel mais quasi incontournable pour une page film/série
getMovieRecommendations(tmdbId) / getMovieSimilar(tmdbId) + équivalents TV	La Phase 5 prévoit un calcul maison des "films/séries connexes", mais TMDB fournit déjà cette donnée — utile en bootstrap ou en complément le temps d'avoir assez de données pour ton propre algo
getCollectionDetails(collectionId)	TMDB regroupe certains films en "collections" (sagas) — pertinent pour enrichir les "films connexes" sur des franchises, mais pas de table collections dans ton schéma actuel donc à évaluer
getTrending(mediaType, timeWindow)	Utile pour une page d'accueil/découverte, absent de la roadmap actuelle
getDiscoverMovie(filters) / getDiscoverTv(filters)	Recherche avancée par genre/année/note — utile si tu veux une page "parcourir" au-delà de la recherche par titre

2. Module tmdb-mapper — mappers manquants (en miroir des endpoints ci-dessus)
mapTmdbEpisodeCredits(tmdbEpisodeCredits, episodeId) → seul mapper capable de remplir credits.episode_id, actuellement mapTmdbCredits ne mappe qu'au niveau titre
mapTmdbPersonExternalIds(tmdbExternalIds) → extraction du wikidata_id
3. Nouveau module wikidata-client (hors TMDB)
getWikipediaUrlFromWikidataId(wikidataId, lang='fr') — trou net : la doc dit que wiki_url vient de Wikidata, mais aucune fonction n'appelle l'API Wikidata nulle part dans la roadmap. Sans ça, people.wiki_url restera toujours NULL.
4. Module tmdb-sync — orchestration manquante
importPersonByTmdbId(tmdbId) — importer une personne en direct (recherche → fiche), pas seulement via un credit de film/série
importEpisodeGuestCredits(episodeId, tmdbId, season, episode) — peuple enfin credits.episode_id
refreshPersonData(personId) — rafraîchissement périodique bio/photo, symétrique à refreshTitleData
bootstrapRecommendationsFromTmdb(titleId) — pré-remplit title_recommendations via TMDB en attendant le batch maison de la Phase 5
5. Côté packages/db — wrappers manquants pour les vues matérialisées

C'est le trou le plus important pour la Phase 6 (dataviz) : Prisma ignore les vues matérialisées à l'introspection (comme il ignore triggers/fonctions). Donc prisma.mv_watch_time_by_genre.findMany() ne fonctionnera jamais. Il faut des wrappers $queryRaw dans packages/db/src, exactement sur le modèle de functions.ts (countEpisodesNonVus, getSerieProgress) :

getWatchTimeByPeriod(userId)
getWatchTimeByGenre(userId)
getWatchTimeByCountry(userId)
getWatchTimeByAnimation(userId)
getWatchCountByGenre(userId)
getWatchCountByPeriod(userId)
getWatchCountByCountry(userId)
getWatchCountByAnimation(userId)

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
Convention : chaque module NestJS = module / controller / service / dto, connecté à @emdb/db (Prisma) et, quand nécessaire, à tmdb-client / tmdb-sync (Phase 2).

3.0 Socle transverse (préalable à tous les modules)
 Dépendances manquantes dans apps/api/package.json (actuellement absentes) :
class-validator, class-transformer (DTO validation — indispensable, rien n'est prévu actuellement)
@nestjs/jwt, @nestjs/passport, passport, passport-jwt (auth)
bcrypt (hash mot de passe — password_hash existe déjà dans le schéma mais rien ne l'écrit)
@nestjs/throttler (rate limiting sur les endpoints qui proxient TMDB, pour éviter de cramer le quota API)
 main.ts : ajouter app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
 main.ts : configurer Swagger (@nestjs/swagger est déjà une dépendance mais inutilisée — DocumentBuilder + SwaggerModule.setup('/docs', app, document))
 PrismaModule : wrapper NestJS autour du singleton prisma exporté par @emdb/db, pour l'injecter proprement (@Injectable() PrismaService extends PrismaClient ou provider { provide: 'PRISMA', useValue: prisma }) plutôt que d'importer le singleton partout — facilite les tests avec mocks
 Filtre d'exception global (AllExceptionsFilter) pour formater les erreurs Prisma (P2002, P2025...) en réponses HTTP cohérentes (409, 404...)
 DTOs communs : PaginationDto { page, limit }, PaginatedResult<T> { data, total, page, limit }
3.1 Module auth

⚠️ Gap de schéma à trancher avant de coder : le schéma n'a aucune table pour stocker/révoquer les refresh tokens (pas de refresh_tokens, pas de blacklist). Deux options :

(a) refresh token stateless (JWT signé, expiration courte type 30j, pas de révocation possible avant expiration) — plus simple, cohérent avec l'app à 2 utilisateurs
(b) ajouter une table refresh_tokens (user_id, token_hash, expires_at, revoked_at) dans db_init.sql — permet logout réel et révocation

Je recommande (a) pour rester simple vu l'échelle du projet, sauf si tu veux un vrai logout serveur.

 POST /auth/register — RegisterDto { email, password, pseudo } → hash bcrypt, users.create, retourne { user, accessToken, refreshToken }
 POST /auth/login — LoginDto { email, password } → vérifie hash, retourne les mêmes tokens
 POST /auth/refresh — RefreshDto { refreshToken } → vérifie signature/expiration, émet un nouvel access token
 POST /auth/logout — invalide côté client uniquement si option (a) ; si (b), révoque en base
 GET /auth/me — retourne l'utilisateur courant depuis le JWT

Fonctions AuthService :

register(dto): Promise<{ user, accessToken, refreshToken }>
validateUser(email, password): Promise<User | null>
login(user): Promise<{ accessToken, refreshToken }>
refresh(refreshToken): Promise<{ accessToken }>
logout(userId): Promise<void>
 JwtStrategy.validate(payload) → charge l'utilisateur depuis payload.sub
 JwtAuthGuard (Passport) appliqué globalement, sauf /auth/register, /auth/login, /auth/refresh, /health
 Décorateur @CurrentUser() pour extraire req.user dans les controllers
 PasswordService.hash(plain) / PasswordService.compare(plain, hash)
3.2 Module users
 GET /users/me — profil complet (email, pseudo, avatar_url, created_at)
 PATCH /users/me — UpdateProfileDto { pseudo?, avatar_url? }
 POST /users/me/avatar — upload via multer (déjà dépendance de @nestjs/platform-express), stockage à définir (Supabase Storage a été explicitement écarté pour les images de titres/personnes — à clarifier si ça s'applique aussi aux avatars utilisateurs, ou si on autorise une exception ici vu le faible volume)
 GET /users/search?query= — recherche par pseudo/email, nécessaire pour list_shares : il faut bien un moyen de trouver l'autre utilisateur (toi + la 2ᵉ personne) pour partager une liste
 DELETE /users/me — suppression de compte (cascade déjà géré par les FK ON DELETE CASCADE)

Fonctions UsersService :

getById(id)
updateProfile(id, dto)
updateAvatar(id, url)
findByPseudoOrEmail(query)
delete(id)
3.3 Module titles (le plus gros morceau)
 GET /titles/search?q=&type=film|serie — appelle tmdb-client.searchMovie/searchTv et recherche locale (titre_vo/titre_vf ILIKE), fusionne les résultats en marquant ceux déjà présents localement via tmdb_id
 GET /titles/tmdb/:tmdbId — "get or import" : cherche par tmdb_id, sinon déclenche tmdb-sync.importTitleByTmdbId(tmdbId, type) (Phase 2.3) de façon synchrone ou via job BullMQ selon la latence acceptable
 GET /titles/:id — détail complet : titre + genres (title_genres) + pays (title_countries) + studios (title_studios) + saisons si série
 GET /titles — liste/parcours paginé avec filtres : type, genre_id, country_id, is_animation, note_imdb_min, tri par date_sortie/note_imdb (les index idx_titles_date_sortie et idx_titles_note_imdb existent déjà justement pour ça)
 GET /titles/:id/credits — cast/crew groupés par rôle (délègue à CreditsService)
 GET /titles/:id/seasons — pour les séries (délègue à SeasonsEpisodesService)
 GET /titles/:id/recommendations — lit title_recommendations ; si vide, fallback sur getMovieRecommendations/getMovieSimilar TMDB (cf. bootstrapRecommendationsFromTmdb proposé côté Phase 2)
 PATCH /titles/:id/refresh — force tmdb-sync.refreshTitleData(id)
 DELETE /titles/:id — suppression uniquement si orphelin (aucune user_ratings/user_watches/list_items ne le référence) — cohérent avec le principe de "lazy persistence"

Fonctions TitlesService :

searchTitles(query, type?)
getOrImportByTmdbId(tmdbId, type)
getTitleDetail(id)
listTitles(filters, pagination)
getRecommendations(id)
refreshTitle(id)
deleteIfOrphan(id)

DTOs : SearchTitlesDto, ListTitlesFilterDto, ImportTitleDto

3.4 Module people
 GET /people/search?q= — proxy tmdb-client.searchPerson + fusion locale
 GET /people/tmdb/:tmdbId — get or import (appelle tmdb-sync.importPersonByTmdbId, Phase 2)
 GET /people/:id — détail (bio, photo, wiki_url, pays, date de naissance, genre)
 GET /people/:id/filmography — jointure credits → titles, groupée par rôle, triée par date_sortie
 GET /people/:id/recommendations — lit person_recommendations
 PATCH /people/:id/refresh — force tmdb-sync.refreshPersonData(id)

Fonctions PeopleService :

search(query)
getOrImportByTmdbId(tmdbId)
getById(id)
getFilmography(id)
getRecommendations(id)
refresh(id)

3.5 Module seasons-episodes
 GET /titles/:titleId/seasons — liste des saisons
 GET /titles/:titleId/seasons/:numero — détail saison + liste des épisodes
 GET /episodes/:id — détail épisode (synopsis, date_sortie, image_url, durée)
 GET /episodes/:id/credits — guest stars/crew spécifiques à l'épisode (credits.episode_id) — dépend de la fonction TMDB getTvEpisodeDetails + mapTmdbEpisodeCredits évoquées en Phase 2

⚠️ Ces deux endpoints sont user-agnostic (pure lecture du catalogue). Les endpoints qui dépendent d'un utilisateur — fn_progress_serie (vue datée par saison) et fn_episodes_non_vus (calendrier) — sont logiquement de la Phase 4 ("features utilisateur") même si on pourrait les exposer ici en GET /titles/:titleId/progress. À toi de voir si tu préfères les garder groupés avec seasons-episodes pour la cohérence de route, ou strictement dans un futur module watches.

Fonctions SeasonsEpisodesService :

listSeasons(titleId)
getSeason(titleId, numero)
getEpisode(episodeId)
getEpisodeCredits(episodeId)

3.6 Module credits
 GET /titles/:titleId/credits — groupé cast (role=acteur, trié par ordre) / crew (réalisateur, scénariste...) — utilise la table roles (v3) plutôt que l'ancien CHECK figé
 GET /episodes/:episodeId/credits — credits spécifiques épisode
 GET /people/:personId/credits — vue "reverse" (alias de getFilmography, à voir si on factorise dans un seul endroit pour éviter la duplication avec PeopleService)

Fonctions CreditsService :

getTitleCredits(titleId)
getEpisodeCredits(episodeId)
getPersonCredits(personId)

Pas d'endpoint public nécessaire pour roles (référentiel interne utilisé uniquement au mapping TMDB → base, pas consommé par le frontend).


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

Fichiers de référence : `db_init_v3.sql` (schéma complet avec 8 vues matérialisées), cette roadmap.
Dis-moi si tu veux que je détaille Phase 3 au même niveau de granularité (fonction par fonction, endpoint par endpoint).

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

---

*Dernière mise à jour : 22 juillet 2026*
