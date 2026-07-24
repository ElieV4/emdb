# Roadmap Frontend — eMDB (movie/serie tracker)

Basé sur `README.md`, `emdb_roadmap_backend.md`, `packages/db/sql/db_init.sql` (schéma v2 finalisé) et `docs/phase-*.md`.

> **Contexte** : Le backend (`apps/api` NestJS) expose une API REST complète avec JWT auth. Le frontend est une application **Next.js 14+ (App Router)** qui consomme cette API. Ce document décrit la roadmap frontend complète, phase par phase, en miroir de la roadmap backend.

---

## Stack retenue

| Couche | Techno | Justification |
|---|---|---|
| **Framework** | Next.js 14+ (App Router) | SSR/SSG natif, routing déclaratif, API routes pour le proxy |
| **Langage** | TypeScript | Typage end-to-end avec le backend |
| **UI/Styling** | Tailwind CSS + shadcn/ui + Radix UI | Composants accessibles, thème sombre/light, productivité |
| **Dataviz** | Recharts | Intégration React simple, supporte tous les types de graphiques nécessaires |
| **State management** | Zustand (global) + React Context (auth) | Léger, pas de boilerplate, idéal pour un projet de cette taille |
| **API client** | React Query (TanStack Query) | Cache, mutations, refetch automatique, gestion d'état serveur |
| **Auth** | JWT via httpOnly cookie + NestJS `/auth/*` endpoints | Sécurité (pas de token dans le localStorage), cohérence avec le backend |
| **Tests** | Jest + React Testing Library (unit) + Cypress (e2e) | Couverture complète |
| **CI/CD** | GitHub Actions + Vercel | Déploiement automatique depuis GitHub, gratuit pour usage perso |
| **Hébergement** | Vercel | Hébergeur officiel de Next.js, déploiement instantané |

### Décisions d'architecture validées

| Question | Décision | Justification |
|---|---|---|
| Next.js Router | App Router (Next.js 14+) | SSR/SSG natif, layout système, loading.tsx |
| Component library | shadcn/ui + Radix UI | Composants accessibles, thème sombre/light, productivité |
| Charting | Recharts | Intégration React simple, supporte tous les types de graphiques |
| State management | Zustand + React Context (auth) | Léger, pas de boilerplate |
| API client | React Query | Cache, mutations, refetch automatique |
| Auth | httpOnly cookie + NestJS endpoints | Sécurité (pas de token dans localStorage) |
| Tests | Jest + RTL (unit) + Cypress (e2e) | Couverture complète |
| Structure | `apps/web/` dans le monorepo | Cohérent avec `apps/api` et `apps/worker` |

---

## Architecture du projet

```
emdb/
├── apps/
│   ├── api/           # NestJS backend (existant)
│   ├── worker/        # BullMQ worker (existant)
│   └── web/           # Next.js frontend (À CRÉER)
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/
│       │   │   ├── register/
│       │   │   └── layout.tsx
│       │   ├── (titles)/
│       │   │   ├── [id]/
│       │   │   ├── search/
│       │   │   └── layout.tsx
│       │   ├── (people)/
│       │   │   └── [id]/
│       │   ├── (series)/
│       │   │   └── [id]/
│       │   ├── calendar/
│       │   ├── dataviz/
│       │   ├── lists/
│       │   ├── notifications/
│       │   ├── profile/
│       │   ├── admin/
│       │   │   └── recommendations/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   └── loading.tsx
│       ├── components/
│       │   ├── ui/           # shadcn/ui (générés)
│       │   ├── layout/       # Header, Sidebar, Footer
│       │   ├── titles/       # TitleCard, TitlePoster, TitleSearchBar
│       │   ├── people/       # PersonCard, PersonBadge
│       │   ├── seasons/      # SeasonCard, EpisodeRow
│       │   ├── watches/      # WatchButton, WatchHistoryItem, FollowButton
│       │   ├── ratings/      # RatingInput, RatingBadge, RatingSummary
│       │   ├── lists/        # ListCard, ListItem, ListShareDialog
│       │   ├── dataviz/      # WatchTimeChart, WatchCountChart, DatavizFilters
│       │   ├── recommender/  # RecommendationsCarousel, AdminRecommendations
│       │   ├── notifications/ # NotificationItem, NotificationsBadge
│       │   ├── admin/        # AdminGuard, AdminRefreshButton
│       │   └── common/       # ErrorBoundary, LoadingSpinner, Pagination
│       ├── hooks/
│       │   ├── api/          # useTitles, usePeople, useWatches, useRatings, useLists
│       │   ├── auth/         # useAuth, useLogin, useRegister, useLogout
│       │   ├── ui/           # useDebounce, useLocalStorage, useMediaQuery
│       │   └── dataviz/      # useWatchTime, useWatchCount
│       ├── lib/
│       │   ├── api/          # apiClient (React Query + fetch wrapper)
│       │   ├── auth/         # authClient (login, register, refresh)
│       │   ├── utils/        # formatDate, formatDuration, slugify
│       │   ├── dataviz/      # transformers.ts (MV → Recharts format)
│       │   └── types/        # TypeScript types (Title, Person, Episode, etc.)
│       ├── store/
│       │   ├── authStore.ts  # Zustand — état utilisateur
│       │   └── uiStore.ts    # Zustand — thème, sidebar ouverte, etc.
│       ├── styles/
│       │   ├── globals.css
│       │   └── theme.css
│       ├── __tests__/
│       │   ├── unit/
│       │   └── integration/
│       ├── cypress/
│       │   ├── e2e/
│       │   └── fixtures/
│       ├── middleware.ts
│       ├── next.config.js
│       ├── tailwind.config.js
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── db/              # Prisma (existant)
│   ├── tmdb-client/     # Client TMDB (existant)
│   ├── tmdb-mapper/     # Mapping TMDB → interne (existant)
│   ├── tmdb-sync/       # Orchestration import (existant)
│   ├── recommender/     # Algorithme Jaccard (existant)
│   └── wikidata-client/ # Client Wikidata (existant)
├── docker-compose.yml
├── package.json
└── emdb_roadmap_backend.md
```

---

## Phase 0 — Socle technique frontend

> **Correspondance backend** : Phase 0 (socle technique)

### 0.1 Création du workspace Next.js

- [x] `npx create-next-app@latest apps/web --ts --tailwind` dans le monorepo
- [x] Configurer `tsconfig.json` pour le path alias `@/` → `./`
- [x] Configurer `next.config.js` :
  - `output: 'standalone'` (pour Docker/Vercel)
  - `images: { remotePatterns: [{ hostname: 'image.tmdb.org' }] }` (affiches TMDB)
- [x] Configurer `tailwind.config.js` :
  - shadcn/ui setup (`npx shadcn-ui@latest init`)
  - Thème sombre/light avec `class` strategy
  - Couleurs personnalisées (primary, secondary, accent)
- [x] Configurer `.eslintrc` + `.prettierrc` (hérité du monorepo)
- [x] Scripts npm : `dev`, `build`, `start`, `lint`, `test`, `test:e2e`

### 0.2 Client API & React Query

- [x] `lib/api/apiClient.ts` — wrapper fetch avec :
  - Base URL depuis `NEXT_PUBLIC_API_URL` (`.env.local`)
  - Intercepteur pour rafraîchir le token JWT (via `/auth/refresh`)
  - Gestion des erreurs (401 → redirect login, 403 → forbidden page, 404 → not found)
  - Timeout configurable (10s)
- [x] `lib/api/queryClient.ts` — configuration globale de React Query :
  - `staleTime: 5 * 60 * 1000` (5 min)
  - `cacheTime: 10 * 60 * 1000` (10 min)
  - `retry: 1` (pas de retry sur 4xx)
  - `refetchOnWindowFocus: true` (rafraîchir à la réactivation)
- [x] `lib/api/types.ts` — types TypeScript partagés :
  - `Title`, `Person`, `Episode`, `Season`, `Credit`, `Genre`, `Country`
  - `User`, `UserRating`, `UserWatch`, `UserList`, `ListShare`
  - `PaginationResult<T>`, `ApiResponse<T>`

### 0.3 Auth context & store

- [x] `store/authStore.ts` — Zustand store :
  - `user: AuthenticatedUser | null`
  - `accessToken: string | null`
  - `isAuthenticated: boolean`
  - `isLoading: boolean`
  - Actions : `login()`, `register()`, `logout()`, `refreshToken()`, `fetchCurrentUser()`
- [x] `hooks/auth/useAuth()` — hook pour accéder au store
- [x] `hooks/auth/useLogin()` — mutation React Query pour `/auth/login`
- [x] `hooks/auth/useRegister()` — mutation React Query pour `/auth/register`
- [x] `hooks/auth/useLogout()` — mutation pour `/auth/logout`
- [x] Middleware Next.js `middleware.ts` :
  - Vérifier le token JWT à chaque navigation
  - Rediriger vers `/login` si non authentifié (pour les routes protégées)
  - Rafraîchir le token si expiré
  - Routes publiques : `/`, `/login`, `/register`, `/titles/:id`, `/people/:id`

### 0.4 Layout & composants de base

- [x] `components/layout/Header.tsx` — navigation responsive :
  - Logo eMDB
  - Liens : Accueil, Recherche, Calendrier, Mes listes, Dataviz, Notifications
  - Bouton connexion/déconnexion
  - Toggle thème sombre/light
  - Menu mobile (hamburger)
- [ ] `components/layout/Sidebar.tsx` — sidebar desktop (optionnel)
- [x] `components/layout/Footer.tsx` — footer minimal
- [x] `components/common/LoadingSpinner.tsx` — spinner réutilisable
- [x] `components/common/ErrorBoundary.tsx` — boundary pour les erreurs React
- [x] `components/common/Pagination.tsx` — pagination avec `PaginationResult<T>`
- [x] `app/loading.tsx` — loading global
- [x] `app/error.tsx` — error global
- [x] `app/not-found.tsx` — page 404

### 0.5 Tests

- [x] Config Jest + React Testing Library (`jest.config.js`, `jest.setup.ts`)
- [x] Config Cypress (`cypress.config.ts`, `cypress/e2e/`, `cypress/fixtures/`)
- [ ] CI GitHub Actions : lint → format:check → test → build

---

## Phase 1 — Pages d'authentification

> **Correspondance backend** : Phase 3.1 (Module auth)

### 1.1 Pages

- [ ] `app/(auth)/login/page.tsx` — formulaire login :
  - Champs : email, password
  - Validation : email requis, password requis (min 6)
  - Bouton "Se connecter"
  - Lien "Créer un compte"
  - Affichage des erreurs (email/password invalide → 401)
  - Redirection vers `/` ou `?redirect=` après login
- [ ] `app/(auth)/register/page.tsx` — formulaire register :
  - Champs : email, pseudo, password, confirm password
  - Validation : email valide, pseudo (3-30 chars), password (min 6), confirmation
  - Bouton "Créer le compte"
  - Lien "Déjà un compte ? Connectez-vous"
  - Affichage des erreurs (email/pseudo déjà utilisé → 409)
- [ ] `app/(auth)/layout.tsx` — layout sans header/sidebar (page blanche centrée)

### 1.2 Hooks & store

- [ ] `hooks/auth/useLogin()` — React Query mutation :
  - POST `/auth/login`
  - Stock le token + user dans Zustand
  - Redirect vers la page précédente ou `/`
- [ ] `hooks/auth/useRegister()` — React Query mutation :
  - POST `/auth/register`
  - Stock le token + user dans Zustand
  - Redirect vers `/`
- [ ] `hooks/auth/useLogout()` — mutation :
  - POST `/auth/logout`
  - Clear le store Zustand
  - Redirect vers `/login`

### 1.3 Composants

- [ ] `components/auth/LoginForm.tsx`
- [ ] `components/auth/RegisterForm.tsx`
- [ ] `components/auth/AuthInput.tsx` — input avec label, validation, error message

### 1.4 Tests

- [ ] Login form : validation des champs, affichage erreur, redirect après login
- [ ] Register form : validation, confirmation password, affichage erreur 409
- [ ] Auth store : login/logout/refresh

---

## Phase 2 — Pages de recherche & navigation

> **Correspondance backend** : Phase 3.3 (Titles), 3.4 (People)

### 2.1 Page d'accueil

- [ ] `app/page.tsx` — dashboard :
  - Si non connecté : page de bienvenue + CTA login/register
  - Si connecté :
    - Continue watching (séries suivies avec progrès)
    - Watchlist (films/séries à voir)
    - Favoris
    - Activité récente (watches des 7 derniers jours)
    - Recommandations personnalisées (si disponibles)

### 2.2 Recherche

- [ ] `app/search/page.tsx` — page de recherche :
  - Input de recherche avec debounce (500ms)
  - Tabs : Films, Séries, Personnes
  - Résultats en grid (TitleCard / PersonCard)
  - Filtres : type (film/serie), genre, pays, année
  - Pagination
- [ ] `components/titles/TitleSearchBar.tsx` — input avec suggestions (autocomplete)
  - Suggestions : titres locaux + résultats TMDB
  - Navigation clavier (↑↓ pour naviguer, Enter pour sélectionner)

### 2.3 Navigation & routing

- [ ] `app/titles/[id]/page.tsx` — page détail titre
- [ ] `app/people/[id]/page.tsx` — page détail personne
- [ ] `app/series/[id]/page.tsx` — page détail série (alias de titles/[id] avec type=serie)
- [ ] `app/calendar/page.tsx` — calendrier épisodes non vus
- [ ] `app/dataviz/page.tsx` — page dataviz
- [ ] `app/lists/page.tsx` — page liste des listes
- [ ] `app/lists/[id]/page.tsx` — détail d'une liste
- [ ] `app/profile/page.tsx` — profil utilisateur
- [ ] `app/notifications/page.tsx` — liste des notifications

### 2.4 Hooks

- [ ] `hooks/api/useTitles()` — hooks pour la recherche et les listes de titres
- [ ] `hooks/api/useTitle(id)` — hook pour le détail d'un titre
- [ ] `hooks/api/usePeople()` — hooks pour la recherche de personnes
- [ ] `hooks/api/usePerson(id)` — hook pour le détail d'une personne
- [ ] `hooks/api/useSearch(query, type)` — hook de recherche avec debounce

### 2.5 Composants

- [ ] `components/titles/TitleCard.tsx` — card titre (affiche, titre, note, année, type)
- [ ] `components/titles/TitlePoster.tsx` — affiche avec fallback
- [ ] `components/titles/TitleSearchBar.tsx` — input de recherche
- [ ] `components/people/PersonCard.tsx` — card personne (photo, nom, rôle)
- [ ] `components/people/PersonBadge.tsx` — badge compact (pour la distribution)

### 2.6 Tests

- [ ] Search page : debounce, filtres, pagination
- [ ] TitleCard : affichage correct des props, fallback affiche
- [ ] PersonCard : affichage correct

---

## Phase 3 — Pages de détail (titres, personnes, saisons, épisodes)

> **Correspondance backend** : Phase 3.3 (Titles), 3.4 (People), 3.5 (Seasons-Episodes), 3.6 (Credits)

### 3.1 Page détail titre (film)

> **Backend** : `GET /titles/:id`

- [ ] `app/titles/[id]/page.tsx` :
  - Hero banner avec affiche + synopsis
  - Titre VO/VF, année, durée, note IMDB
  - Genres (badges cliquables)
  - Pays de production (badges)
  - Date de sortie
  - Distribution (cast/crew groupé par rôle) — `GET /titles/:id/credits`
  - Films connexes (recommendations) — `GET /titles/:id/recommendations`
  - Bouton "Marquer comme vu" (si connecté)
  - Bouton "Noter" (si connecté)
  - Bouton "Ajouter à une liste" (si connecté)
  - Bouton "Suivre" (si série)
  - Section "Épisodes" (si série) — lien vers saisons

### 3.2 Page détail série

> **Backend** : `GET /titles/:id`, `GET /titles/:id/seasons`, `GET /titles/:titleId/progress`

- [ ] `app/series/[id]/page.tsx` (ou `app/titles/[id]/page.tsx` avec type=serie) :
  - Hero banner
  - Statut de la série (en cours, terminée, annulée)
  - Prochain épisode (next_episode_air_date)
  - Progrès de visionnage (fn_progress_serie) — barre de progression + détail par saison
  - Nombre d'épisodes non vus (fn_episodes_non_vus)
  - Bouton "Suivre" / "Ne plus suivre"
  - Liste des saisons (accordéon ou grid)
  - Distribution
  - Séries connexes (recommendations)
  - Notes/ratings publiques du titre

### 3.3 Page détail personne

> **Backend** : `GET /people/:id`, `GET /people/:id/filmography`

- [ ] `app/people/[id]/page.tsx` :
  - Photo + nom
  - Genre (homme/femme/autre)
  - Âge (calculé depuis date_naissance)
  - Pays d'origine
  - Bio courte + lien Wikipedia (wiki_url)
  - Filmographie groupée par rôle :
    - En tant qu'acteur (avec personnage)
    - En tant que réalisateur
    - En tant que scénariste
    - Autres rôles
  - Personnes connexes (recommendations) — `GET /people/:id/recommendations`
  - Chaque titre de la filmographie est cliquable → page détail titre

### 3.4 Page saison

> **Backend** : `GET /titles/:titleId/seasons/:numero`

- [ ] `app/series/[id]/seasons/[numero]/page.tsx` :
  - Header saison (numéro, titre, date de sortie, synopsis)
  - Liste des épisodes (tableau ou liste) :
    - Numéro, titre, date de sortie, durée
    - Image (still_path)
    - Bouton "Marquer comme vu"
    - Bouton "Noter"
    - Statut vu/non-vu (check visuel)
  - Liens vers épisodes voisins

### 3.5 Page épisode

> **Backend** : `GET /episodes/:id`, `GET /episodes/:id/credits`

- [ ] `app/episodes/[id]/page.tsx` :
  - Header épisode (saison, numéro, titre, date de sortie, durée, image)
  - Synopsis
  - Guest stars / crew spécifiques à l'épisode — `GET /episodes/:id/credits`
  - Bouton "Marquer comme vu"
  - Bouton "Noter"
  - Liens vers épisode précédent/suivant

### 3.6 Composants détaillés

- [ ] `components/titles/TitleHero.tsx` — hero banner titre
- [ ] `components/titles/TitleInfo.tsx` — métadonnées (genres, pays, dates)
- [ ] `components/titles/TitleCredits.tsx` — distribution groupée par rôle
- [ ] `components/titles/TitleRecommendations.tsx` — carrousel de titres connexes
- [ ] `components/seasons/SeasonCard.tsx` — card saison
- [ ] `components/seasons/EpisodeRow.tsx` — ligne d'épisode (dans un tableau)
- [ ] `components/seasons/EpisodeCard.tsx` — card épisode (mobile)
- [ ] `components/people/PersonHero.tsx` — hero personne
- [ ] `components/people/Filmography.tsx` — filmographie groupée par rôle

### 3.7 Hooks

- [ ] `hooks/api/useTitleCredits(titleId)` — `GET /titles/:titleId/credits`
- [ ] `hooks/api/useTitleRecommendations(titleId)` — `GET /titles/:titleId/recommendations`
- [ ] `hooks/api/useSeasons(titleId)` — `GET /titles/:titleId/seasons`
- [ ] `hooks/api/useSeason(titleId, numero)` — `GET /titles/:titleId/seasons/:numero`
- [ ] `hooks/api/useEpisode(id)` — `GET /episodes/:id`
- [ ] `hooks/api/useEpisodeCredits(id)` — `GET /episodes/:id/credits`
- [ ] `hooks/api/usePersonFilmography(id)` — `GET /people/:id/filmography`
- [ ] `hooks/api/usePersonRecommendations(id)` — `GET /people/:id/recommendations`

### 3.8 Tests

- [ ] Title detail page : affichage des métadonnées, distribution, recommendations
- [ ] Series detail page : progrès, prochain épisode, saisons
- [ ] Person detail page : filmographie groupée, liens Wikipedia
- [ ] Episode row : statut vu/non-vu, boutons watch/rating
- [ ] Season page : liste des épisodes, tri par numéro

---

## Phase 4 — Fonctionnalités utilisateur

> **Correspondance backend** : Phase 4 (watches, ratings, lists, follows)

### 4.1 Module `watches` — visionnage + calendrier

> **Backend** : `POST /watches`, `DELETE /watches/:id`, `GET /watches`, `GET /titles/:titleId/progress`, `GET /calendar`, `POST /follows`, `DELETE /follows/:titleId`, `GET /follows`

#### 4.1.1 Pages

- [ ] `app/calendar/page.tsx` — calendrier épisodes non vus :
  - Liste des séries suivies avec :
    - Titre, affiche, saison courante
    - Nombre d'épisodes non vus (fn_episodes_non_vus)
    - Prochaine date de diffusion
  - Tri par nb_non_vus décroissant
  - Filtre par série (optionnel)
- [ ] `app/watches/page.tsx` — historique des visionnages :
  - Liste paginée des watches (date, titre, épisode)
  - Filtres : type (film/serie), date_from, date_to, title_id
  - Tri par date (défaut : récent → ancien)
  - Bouton "Supprimer" sur chaque watch

#### 4.1.2 Composants

- [ ] `components/watches/WatchButton.tsx` — bouton "Marquer comme vu" (toggle)
  - Pour un titre : marque le film comme vu
  - Pour un épisode : marque l'épisode comme vu
  - Date picker optionnel (défaut : aujourd'hui)
- [ ] `components/watches/WatchHistoryItem.tsx` — item d'historique
- [ ] `components/watches/ProgressSerie.tsx` — barre de progression par saison
  - Affiche vus/total par saison (fn_progress_serie)
  - Pourcentage global
- [ ] `components/watches/FollowButton.tsx` — bouton suivre/ne plus suivre
  - Toggle sur la page série
  - Toggle dans le calendrier

#### 4.1.3 Hooks

- [ ] `hooks/api/useWatches(filters)` — `GET /watches`
- [ ] `hooks/api/useCreateWatch()` — `POST /watches`
- [ ] `hooks/api/useDeleteWatch()` — `DELETE /watches/:id`
- [ ] `hooks/api/useSerieProgress(titleId)` — `GET /titles/:titleId/progress`
- [ ] `hooks/api/useCalendar()` — `GET /calendar`
- [ ] `hooks/api/useFollows()` — `GET /follows`
- [ ] `hooks/api/useFollow()` — `POST /follows`
- [ ] `hooks/api/useUnfollow()` — `DELETE /follows/:titleId`

#### 4.1.4 Tests

- [ ] WatchButton : toggle vu/non-vu, date picker
- [ ] Calendar page : liste des séries suivies, nb_non_vus
- [ ] ProgressSerie : affichage par saison, pourcentage
- [ ] Watch history : filtres, pagination, suppression

### 4.2 Module `ratings` — notes & commentaires

> **Backend** : `PUT /ratings`, `DELETE /ratings/:id`, `GET /ratings`, `GET /titles/:id/ratings` (public)

#### 4.2.1 Pages

- [ ] `app/ratings/page.tsx` — mes notes :
  - Liste paginée des notes de l'utilisateur
  - Filtre par type (film/serie)
  - Affichage : titre, note, commentaire, date
  - Bouton "Supprimer"
  - Bouton "Modifier" (édition inline)

#### 4.2.2 Composants

- [ ] `components/ratings/RatingInput.tsx` — input de notation (étoiles 0-10)
  - Click pour noter, hover pour preview
  - Supporte les demi-étoiles (0.5)
  - Affichage de la note actuelle si déjà noté
- [ ] `components/ratings/RatingBadge.tsx` — badge affichant la note (ex: 8.5/10)
- [ ] `components/ratings/RatingSummary.tsx` — résumé public des notes d'un titre
  - Moyenne, count, répartition par note (barres)
  - Accessible depuis la page détail titre
- [ ] `components/ratings/CommentaireInput.tsx` — textarea pour le commentaire

#### 4.2.3 Hooks

- [ ] `hooks/api/useUpsertRating()` — `PUT /ratings`
- [ ] `hooks/api/useDeleteRating()` — `DELETE /ratings/:id`
- [ ] `hooks/api/useUserRatings(filters)` — `GET /ratings`
- [ ] `hooks/api/useTitleRatingsSummary(titleId)` — `GET /titles/:id/ratings` (public)

#### 4.2.4 Tests

- [ ] RatingInput : sélection 0-10, demi-étoiles, note actuelle
- [ ] RatingSummary : moyenne, répartition, count
- [ ] Ratings page : liste, filtre, suppression

### 4.3 Module `lists` — listes, items, partage

> **Backend** : `POST /lists`, `GET /lists`, `GET /lists/:id`, `PATCH /lists/:id`, `DELETE /lists/:id`, `POST /lists/:listId/items`, `DELETE /lists/:listId/items/:titleId`, `PATCH /lists/:listId/items/reorder`, `POST /lists/:listId/shares`, `GET /lists/:listId/shares`, `DELETE /lists/:listId/shares/:userId`, `GET /shared-lists`

#### 4.3.1 Pages

- [ ] `app/lists/page.tsx` — mes listes :
  - Grille de listes (watchlist, favoris, custom)
  - Bouton "Créer une liste"
  - Chaque liste → clic → page détail
- [ ] `app/lists/[id]/page.tsx` — détail d'une liste :
  - Header (nom, type, description, propriétaire)
  - Liste des items (titles) en grid ou liste
  - Mode édition : réordonnancement par drag & drop
  - Bouton "Partager" (si propriétaire)
  - Bouton "Supprimer" (si propriétaire)
  - Bouton "Ajouter un item" (si propriétaire ou édition)
- [ ] `app/shared-lists/page.tsx` — listes partagées avec moi :
  - Liste des listes où j'ai accès (lecture/édition)
  - Indicateur de permission (lecture/édition)

#### 4.3.2 Composants

- [ ] `components/lists/ListCard.tsx` — card liste (nom, type, nb items, description)
- [ ] `components/lists/ListDialog.tsx` — dialog création/édition de liste
  - Champs : nom, type (watchlist/favoris/custom), description
- [ ] `components/lists/ListItemsGrid.tsx` — grid d'items (TitleCard)
- [ ] `components/lists/ListReorder.tsx` — mode réordonnancement (drag & drop)
  - Utilise `@dnd-kit/core`
  - Sauvegarde via `PATCH /lists/:listId/items/reorder`
- [ ] `components/lists/ListShareDialog.tsx` — dialog de partage
  - Recherche d'utilisateur (par pseudo/email)
  - Sélection de permission (lecture/édition)
- [ ] `components/lists/ListSharesList.tsx` — liste des partages existants

#### 4.3.3 Hooks

- [ ] `hooks/api/useLists()` — `GET /lists`
- [ ] `hooks/api/useList(id)` — `GET /lists/:id`
- [ ] `hooks/api/useCreateList()` — `POST /lists`
- [ ] `hooks/api/useUpdateList()` — `PATCH /lists/:id`
- [ ] `hooks/api/useDeleteList()` — `DELETE /lists/:id`
- [ ] `hooks/api/useAddItem()` — `POST /lists/:listId/items`
- [ ] `hooks/api/useRemoveItem()` — `DELETE /lists/:listId/items/:titleId`
- [ ] `hooks/api/useReorderItems()` — `PATCH /lists/:listId/items/reorder`
- [ ] `hooks/api/useShares(listId)` — `GET /lists/:listId/shares`
- [ ] `hooks/api/useShareList()` — `POST /lists/:listId/shares`
- [ ] `hooks/api/useRemoveShare()` — `DELETE /lists/:listId/shares/:userId`
- [ ] `hooks/api/useSharedLists()` — `GET /shared-lists`

#### 4.3.4 Tests

- [ ] ListCard : affichage nom/type/nb items
- [ ] ListDialog : validation, création, édition
- [ ] ListReorder : drag & drop, sauvegarde position
- [ ] ListShareDialog : recherche utilisateur, permission
- [ ] Lists page : création, suppression, affichage

### 4.4 Module `follows` — suivi de séries

> **Backend** : `POST /follows`, `DELETE /follows/:titleId`, `GET /follows`

#### 4.4.1 Pages

- [ ] `app/follows/page.tsx` — mes séries suivies :
  - Grille de séries suivies
  - Chaque série → clic → page détail série
  - Indicateur nb episodes non vus

#### 4.4.2 Composants

- [ ] `components/watches/FollowButton.tsx` — bouton suivre (déjà dans 4.1.2)
- [ ] `components/watches/FollowedSeriesGrid.tsx` — grid de séries suivies

#### 4.4.3 Hooks

- [ ] `hooks/api/useFollows()` — `GET /follows`
- [ ] `hooks/api/useFollow()` — `POST /follows`
- [ ] `hooks/api/useUnfollow()` — `DELETE /follows/:titleId`

#### 4.4.4 Tests

- [ ] FollowButton : toggle suivre/ne plus suivre
- [ ] FollowedSeriesGrid : affichage, nb episodes non vus

---

## Phase 5 — Recommandations

> **Correspondance backend** : Phase 5 (recommender)

### 5.1 Affichage des recommandations

> **Backend** : `GET /titles/:id/recommendations`, `GET /people/:id/recommendations`

- [ ] Intégrer les recommandations dans les pages détail titre/personne :
  - Carrousel horizontal de titres/personnes recommandés
  - Affichage du score (optionnel)
  - Clic → navigation vers la page détail
- [ ] Page "Recommandations" (optionnel) :
  - `app/recommendations/page.tsx`
  - Recommandations basées sur les titres déjà vus/notés

### 5.2 Page admin recommandations

> **Backend** : `POST /admin/compute-recommendations`, `GET /admin/compute-recommendations/:jobId/status`, `GET /admin/recommendations/stats`

- [ ] `app/admin/recommendations/page.tsx` — page admin :
  - Bouton "Lancer le calcul des recommandations"
  - Sélection du mode : titles, people, all
  - Affichage du jobId + statut (waiting/active/completed/failed)
  - Bouton "Voir le statut"
  - Section stats : total recommendations, dernier run, durée
- [ ] `app/admin/recommendations/[jobId]/page.tsx` — page statut job :
  - Statut en temps réel (polling toutes les 5s)
  - Résultat (titles_computed, people_computed)
  - Durée

### 5.3 Composants

- [ ] `components/recommender/RecommendationsCarousel.tsx` — carrousel horizontal
- [ ] `components/recommender/AdminRecommendations.tsx` — interface admin
- [ ] `components/recommender/JobStatus.tsx` — affichage du statut d'un job

### 5.4 Hooks

- [ ] `hooks/api/useComputeRecommendations()` — `POST /admin/compute-recommendations`
- [ ] `hooks/api/useJobStatus(jobId)` — `GET /admin/compute-recommendations/:jobId/status`
- [ ] `hooks/api/useRecommendationStats()` — `GET /admin/recommendations/stats`

### 5.5 Tests

- [ ] RecommendationsCarousel : affichage, navigation
- [ ] AdminRecommendations : lancement, statut, stats
- [ ] JobStatus : polling, affichage statut

---

## Phase 6 — Dataviz

> **Correspondance backend** : Phase 6.1 (dataviz API) + Phase 6.2 (admin refresh BullMQ)

### 6.1 Page dataviz

> **Backend** : `GET /dataviz/watch-time?groupBy=genre|period|country|animation&yearFrom=&yearTo=`, `GET /dataviz/watch-count?groupBy=...`

- [ ] `app/dataviz/page.tsx` — page dataviz :
  - Tabs : Temps de visionnage | Nombre de visionnages
  - Sélecteur de groupement : période | genre | pays | animation
  - Filtres : yearFrom, yearTo (input number)
  - Graphique principal (Recharts) :
    - **Period** : line chart (temps ou count par semaine/mois/année)
    - **Genre** : bar chart horizontal
    - **Country** : bar chart horizontal
    - **Animation** : pie chart (animation vs live-action)
  - Résumé : total minutes, total visionnages, période couverte
  - Bouton "Rafraîchir les données" (admin seulement) — `POST /admin/refresh-materialized-views`

### 6.2 Graphiques Recharts

- [ ] `components/dataviz/WatchTimeByPeriodChart.tsx` — line chart
- [ ] `components/dataviz/WatchTimeByGenreChart.tsx` — bar chart horizontal
- [ ] `components/dataviz/WatchTimeByCountryChart.tsx` — bar chart horizontal
- [ ] `components/dataviz/WatchTimeByAnimationChart.tsx` — pie chart
- [ ] `components/dataviz/WatchCountByPeriodChart.tsx` — line chart
- [ ] `components/dataviz/WatchCountByGenreChart.tsx` — bar chart horizontal
- [ ] `components/dataviz/WatchCountByCountryChart.tsx` — bar chart horizontal
- [ ] `components/dataviz/WatchCountByAnimationChart.tsx` — pie chart
- [ ] `components/dataviz/DatavizSummary.tsx` — résumé (total minutes, total count)
- [ ] `components/dataviz/DatavizFilters.tsx` — filtres (groupBy, yearFrom, yearTo)

### 6.3 Transformation des données

> Les vues matérialisées retournent des données agrégées. Le frontend doit les transformer pour Recharts.

- [ ] `lib/dataviz/transformers.ts` :
  - `transformWatchTimeByPeriod(data)` → `[{ date, minutes }]`
  - `transformWatchTimeByGenre(data, genres)` → `[{ genre, minutes }]`
  - `transformWatchTimeByCountry(data, countries)` → `[{ country, minutes }]`
  - `transformWatchTimeByAnimation(data)` → `[{ type, minutes }]`
  - Même logique pour watch-count
- [ ] `hooks/dataviz/useWatchTime(query)` — wrapper React Query autour de `GET /dataviz/watch-time`
- [ ] `hooks/dataviz/useWatchCount(query)` — wrapper React Query autour de `GET /dataviz/watch-count`
- [ ] `hooks/api/useGenres()` — cache des genres (pour transformer les IDs en noms)
- [ ] `hooks/api/useCountries()` — cache des pays (pour transformer les IDs en noms)

### 6.4 Admin refresh (Phase 6.2)

> **Backend** : `POST /admin/refresh-materialized-views` (JWT + admin, via BullMQ queue `tmdb-cron`)

- [ ] `components/admin/AdminRefreshButton.tsx` — bouton de rafraîchissement :
  - Visible uniquement si l'utilisateur est admin (ADMIN_EMAILS)
  - Appelle `POST /admin/refresh-materialized-views`
  - Affiche le jobId + statut "queued"
  - Polling du statut (optionnel)
- [ ] `hooks/api/useRefreshMaterializedViews()` — `POST /admin/refresh-materialized-views`
- [ ] `components/admin/AdminGuard.tsx` — HOC/guard pour les pages admin

### 6.5 Tests

- [ ] Dataviz page : chargement, filtres, graphiques
- [ ] Transformateurs : conversion des données MV → format Recharts
- [ ] Graphiques : rendu correct, tooltips, légendes
- [ ] AdminRefreshButton : visibilité admin, appel API, affichage jobId

---

## Phase 7 — Notifications

> **Correspondance backend** : Phase 7 (notifications)

### 7.1 Page notifications

> **Backend** : `GET /notifications` (non implémenté côté backend, à suivre)

- [ ] `app/notifications/page.tsx` — page notifications :
  - Liste des notifications (nouvel épisode, rappel, recommandation)
  - Filtrage : non lues en priorité
  - Marquer comme lue (bouton)
  - Suppression (optionnel)
  - Icône par type de notification

### 7.2 Composants

- [ ] `components/notifications/NotificationItem.tsx` — item notification
- [ ] `components/notifications/NotificationsList.tsx` — liste
- [ ] `components/notifications/NotificationsBadge.tsx` — badge dans le header (nb non lues)

### 7.3 Hooks

- [ ] `hooks/api/useNotifications()` — `GET /notifications`
- [ ] `hooks/api/useUnreadNotificationsCount()` — compteur non lues

### 7.4 Tests

- [ ] NotificationsList : affichage, tri (non lues en priorité)
- [ ] NotificationItem : marquage lu, type

---

## Phase 8 — Profil utilisateur

> **Correspondance backend** : Phase 3.2 (Users)

### 8.1 Page profil

> **Backend** : `GET /users/me`, `PATCH /users/me`, `POST /users/me/avatar`, `DELETE /users/me`

- [ ] `app/profile/page.tsx` — page profil :
  - Photo de profil (avatar) + upload
  - Pseudo (modifiable)
  - Email (non modifiable)
  - Date de création du compte
  - Bouton "Supprimer le compte" (avec confirmation)
  - Section "Mes statistiques" :
    - Nombre de titres vus
    - Nombre de notes
    - Nombre de listes
    - Nombre de séries suivies
- [ ] `app/profile/settings/page.tsx` — paramètres (optionnel) :
  - Thème (sombre/light/auto)
  - Langue (fr/en)
  - Notifications (toggle)

### 8.2 Composants

- [ ] `components/users/ProfileHeader.tsx` — header profil (avatar, pseudo, email)
- [ ] `components/users/AvatarUploader.tsx` — upload d'avatar (drag & drop + preview)
- [ ] `components/users/ProfileStats.tsx` — statistiques utilisateur
- [ ] `components/users/DeleteAccountDialog.tsx` — dialog de suppression

### 8.3 Hooks

- [ ] `hooks/api/useCurrentUser()` — `GET /users/me`
- [ ] `hooks/api/useUpdateProfile()` — `PATCH /users/me`
- [ ] `hooks/api/useUploadAvatar()` — `POST /users/me/avatar`
- [ ] `hooks/api/useDeleteAccount()` — `DELETE /users/me`

### 8.4 Tests

- [ ] ProfileHeader : affichage, modification pseudo
- [ ] AvatarUploader : preview, validation MIME/taille
- [ ] DeleteAccountDialog : confirmation, appel API

---

## Phase 9 — Optimisations & polish

### 9.1 Performance

- [ ] Image optimization : `next/image` pour toutes les affiches
- [ ] Lazy loading des images (Intersection Observer)
- [ ] Code splitting : dynamic imports pour les graphiques lourds
- [ ] Prefetching : `next/link` prefetch pour les pages fréquemment visitées
- [ ] React Query : `staleTime` ajusté par endpoint
- [ ] Debounced search : 500ms minimum

### 9.2 UX

- [ ] Animations : Framer Motion pour les transitions
- [ ] Dark mode toggle (persistant dans le store)
- [ ] Loading states : skeleton screens pour les listes/grids
- [ ] Error states : messages d'erreur clairs + retry
- [ ] Empty states : illustrations + CTA pour les listes vides
- [ ] Keyboard navigation : support clavier pour le carousel
- [ ] Responsive design : mobile-first, breakpoints Tailwind

### 9.3 Accessibilité

- [ ] ARIA labels sur tous les composants interactifs
- [ ] Focus management (trap focus dans les dialogs)
- [ ] Contrast ratio ≥ 4.5:1
- [ ] Alt text sur toutes les images
- [ ] Semantic HTML (header, nav, main, section, article)

### 9.4 SEO

- [ ] Meta tags dynamiques (`next/head` ou `generateMetadata`)
- [ ] Open Graph tags pour le partage social
- [ ] Sitemap.xml généré
- [ ] robots.txt

---

## Ordre d'exécution recommandé

> Même logique que la roadmap backend — phases indépendantes d'abord, puis dépendances croissantes.

1. **Phase 0** — socle (Next.js, Tailwind, React Query, auth store, layout)
2. **Phase 1** — auth pages (login, register) + middleware
3. **Phase 2** — recherche + navigation (search, title card, person card)
4. **Phase 3** — pages de détail (titre, série, personne, saison, épisode)
5. **Phase 4.1** — watches (watch button, calendar, progress)
6. **Phase 4.2** — ratings (rating input, summary)
7. **Phase 4.4** — follows (follow button, followed series)
8. **Phase 4.3** — lists (CRUD listes, items, partage)
9. **Phase 8** — profil utilisateur
10. **Phase 5** — recommandations (affichage + admin)
11. **Phase 6** — dataviz (graphiques Recharts + admin refresh)
12. **Phase 7** — notifications
13. **Phase 9** — optimisations & polish

---

## Mapping frontend ↔ backend API

| Frontend (page/hook) | Backend endpoint | Phase backend | Auth |
|---|---|---|---|
| `useLogin()` | `POST /auth/login` | 3.1 | ❌ |
| `useRegister()` | `POST /auth/register` | 3.1 | ❌ |
| `useLogout()` | `POST /auth/logout` | 3.1 | ✅ |
| `useCurrentUser()` | `GET /users/me` | 3.2 | ✅ |
| `useUpdateProfile()` | `PATCH /users/me` | 3.2 | ✅ |
| `useUploadAvatar()` | `POST /users/me/avatar` | 3.2 | ✅ |
| `useSearch()` | `GET /titles/search` | 3.3 | ❌ |
| `useTitle(id)` | `GET /titles/:id` | 3.3 | ❌ |
| `useTitleRecommendations(id)` | `GET /titles/:id/recommendations` | 3.3 | ❌ |
| `usePerson(id)` | `GET /people/:id` | 3.4 | ❌ |
| `usePersonFilmography(id)` | `GET /people/:id/filmography` | 3.4 | ❌ |
| `usePersonRecommendations(id)` | `GET /people/:id/recommendations` | 3.4 | ❌ |
| `useSeasons(titleId)` | `GET /titles/:titleId/seasons` | 3.5 | ❌ |
| `useSeason(titleId, numero)` | `GET /titles/:titleId/seasons/:numero` | 3.5 | ❌ |
| `useEpisode(id)` | `GET /episodes/:id` | 3.5 | ❌ |
| `useEpisodeCredits(id)` | `GET /episodes/:id/credits` | 3.5 | ❌ |
| `useTitleCredits(titleId)` | `GET /titles/:titleId/credits` | 3.6 | ❌ |
| `useCreateWatch()` | `POST /watches` | 4.1 | ✅ |
| `useDeleteWatch()` | `DELETE /watches/:id` | 4.1 | ✅ |
| `useWatches()` | `GET /watches` | 4.1 | ✅ |
| `useSerieProgress()` | `GET /titles/:titleId/progress` | 4.1 | ✅ |
| `useCalendar()` | `GET /calendar` | 4.1 | ✅ |
| `useFollows()` | `GET /follows` | 4.1/4.4 | ✅ |
| `useFollow()` | `POST /follows` | 4.1/4.4 | ✅ |
| `useUnfollow()` | `DELETE /follows/:titleId` | 4.1/4.4 | ✅ |
| `useUpsertRating()` | `PUT /ratings` | 4.2 | ✅ |
| `useDeleteRating()` | `DELETE /ratings/:id` | 4.2 | ✅ |
| `useUserRatings()` | `GET /ratings` | 4.2 | ✅ |
| `useTitleRatingsSummary()` | `GET /titles/:id/ratings` | 4.2 | ❌ |
| `useLists()` | `GET /lists` | 4.3 | ✅ |
| `useList(id)` | `GET /lists/:id` | 4.3 | ✅ |
| `useCreateList()` | `POST /lists` | 4.3 | ✅ |
| `useUpdateList()` | `PATCH /lists/:id` | 4.3 | ✅ |
| `useDeleteList()` | `DELETE /lists/:id` | 4.3 | ✅ |
| `useAddItem()` | `POST /lists/:listId/items` | 4.3 | ✅ |
| `useRemoveItem()` | `DELETE /lists/:listId/items/:titleId` | 4.3 | ✅ |
| `useReorderItems()` | `PATCH /lists/:listId/items/reorder` | 4.3 | ✅ |
| `useShares()` | `GET /lists/:listId/shares` | 4.3 | ✅ |
| `useShareList()` | `POST /lists/:listId/shares` | 4.3 | ✅ |
| `useRemoveShare()` | `DELETE /lists/:listId/shares/:userId` | 4.3 | ✅ |
| `useSharedLists()` | `GET /shared-lists` | 4.3 | ✅ |
| `useWatchTime()` | `GET /dataviz/watch-time` | 6.1 | ✅ |
| `useWatchCount()` | `GET /dataviz/watch-count` | 6.1 | ✅ |
| `useRefreshMaterializedViews()` | `POST /admin/refresh-materialized-views` | 6.2 | ✅ admin |
| `useComputeRecommendations()` | `POST /admin/compute-recommendations` | 5.2 | ✅ admin |
| `useJobStatus()` | `GET /admin/compute-recommendations/:jobId/status` | 5.2 | ✅ admin |
| `useRecommendationStats()` | `GET /admin/recommendations/stats` | 5.2 | ✅ admin |

---

## Design System & Charte graphique

> **Source de vérité** : Toutes les valeurs de design sont définies dans [`apps/web/design-tokens.ts`](../apps/web/design-tokens.ts).  
> **Document de référence** : Les choix de design détaillés et les points à trancher sont dans [`docs/frontend-design-choices.md`](./frontend-design-choices.md).

### Intégration dans le projet

Le fichier `design-tokens.ts` sera :
1. **Consommé par `tailwind.config.js`** pour générer les classes utilitaires Tailwind avec les bonnes valeurs
2. **Importé par les composants** pour accéder aux valeurs de design de manière typée
3. **Utilisé par les composants shadcn/ui** via le theme CSS custom properties

### Structure des tokens

Les tokens sont organisés en catégories sémantiques :
- **Colors** : Primary (rouge eMDB), secondary, accent, semantic (success/warning/danger), text, background, surface, border
- **Typography** : Font families (Inter + JetBrains Mono), font sizes, weights, line heights, letter spacing
- **Spacing** : Base 4px, échelle 4-80
- **Border Radius** : 2px à 12px + full
- **Shadows** : sm/md/lg/xl (désactivés sur dark mode, remplacés par des bordures)
- **Breakpoints** : sm/md/lg/xl/2xl
- **Transitions** : Durées (100-500ms), easings, presets (button/card/modal/toast)
- **Z-Index** : Layers (base → toast)
- **Ratings** : Échelle 0-10, 5 étoiles pleines, demi-étoiles
- **Watch States** : Couleurs vu/en cours/non-vu, badge, check overlay
- **Cards** : TitleCard (2:3), PersonCard (1:1), grid responsive
- **Layout** : Max widths, header, sidebar, page padding
- **Empty States** : Couleurs, icônes, CTA
- **Dark Mode** : Default dark, transitions
- **Accessibility** : Focus ring, touch targets, contrast ratios

### Utilisation dans `tailwind.config.js`

```javascript
// tailwind.config.js
import { designTokens } from '@/design-tokens';

export default {
  theme: {
    extend: {
      colors: {
        primary: designTokens.colors.primary.DEFAULT,
        'primary-hover': designTokens.colors.primary.hover,
        // ... tous les tokens
      },
      fontFamily: {
        sans: designTokens.typography.fontFamily.sans,
        mono: designTokens.typography.fontFamily.mono,
      },
      borderRadius: designTokens.borderRadius,
      boxShadow: designTokens.shadows,
      spacing: designTokens.spacing,
    },
  },
}
```

### Points de design à valider

Les 13 points identifiés dans [`docs/frontend-design-choices.md`](./frontend-design-choices.md) doivent être tranchés avant/imminent le développement. Les valeurs par défaut dans `design-tokens.ts` sont basées sur **Trakt.tv avec primaire rouge** et peuvent être utilisées immédiatement.

---

## Décisions à trancher (questions ouvertes)

| # | Question | Options | Recommandation |
|---|---|---|---|
| 1 | App Router vs Pages Router | App Router (Next 14+) / Pages Router | App Router |
| 2 | Component library | shadcn/ui / Radix pur / Tailwind pur | shadcn/ui + Radix |
| 3 | Charting | Recharts / Chart.js / ApexCharts | Recharts |
| 4 | State management | Zustand / Jotai / Redux Toolkit / React Context | Zustand + Context (auth) |
| 5 | API client | React Query / SWR / Axios + custom | React Query |
| 6 | Auth storage | httpOnly cookie / localStorage / memory | httpOnly cookie |
| 7 | Drag & drop | @dnd-kit/core / react-beautiful-dnd | @dnd-kit/core |
| 8 | Animations | Framer Motion / CSS transitions / AOS | Framer Motion |
| 9 | Tests e2e | Cypress / Playwright / TestCafe | Cypress |
| 10 | Image optimization | next/image / vanilla img | next/image |
| 11 | Refresh token | Cookie httpOnly / localStorage / memory | httpOnly cookie |
| 12 | Admin guard | ADMIN_EMAILS env / champ is_admin / rôle Supabase | ADMIN_EMAILS env |
| 13 | Refresh queue | Queue `dataviz` dédiée / réutiliser `tmdb-cron` | Réutiliser `tmdb-cron` (job déjà défini) |

---

## CI/CD

> **Correspondance backend** : Phase 0 (CI), README (Vercel)

### Frontend CI (GitHub Actions)

- [ ] `.github/workflows/frontend-ci.yml` :
  - Trigger : push/PR sur `main` (chemin `apps/web/**`)
  - Jobs :
    1. **Lint** : `npm run lint --workspace=apps/web`
    2. **Format check** : `npm run format:check --workspace=apps/web`
    3. **Type check** : `npx tsc --noEmit --workspace=apps/web`
    4. **Test** : `npm run test --workspace=apps/web` (Jest)
    5. **Build** : `npm run build --workspace=apps/web` (vérifie que le build passe)
  - Pas de test e2e en CI (trop lent) — Cypress en local/manuel

### Déploiement (Vercel)

- [ ] Connecter le repo GitHub à Vercel
- [ ] Configuration :
  - Framework : Next.js
  - Build command : `npm run build --workspace=apps/web`
  - Output directory : `.next`
  - Root directory : `apps/web`
- [ ] Variables d'environnement :
  - `NEXT_PUBLIC_API_URL` → URL du backend (staging/prod)
- [ ] Preview deployments : automatiques sur chaque PR
- [ ] Production deployment : automatique sur merge `main`

---

## Fichiers de référence

| Fichier | Rôle |
|---|---|
| `README.md` | Stack, fonctionnalités, hébergement |
| `emdb_roadmap_backend.md` | Phases, endpoints, décisions backend |
| `packages/db/sql/db_init.sql` | Schéma DB (tables, types, contraintes) |
| `packages/db/src/functions.ts` | Fonctions PL/pgSQL (fn_episodes_non_vus, fn_progress_serie) |
| `packages/db/prisma/schema.prisma` | Schéma Prisma (introspecté) |
| `packages/db/prisma/README.md` | Gestion Prisma / SQL brut |
| `packages/db/README.md` | Package db partagé |
| `docs/phase-*.md` | Contextes détaillés par phase |
| `docker-compose.yml` | Infra locale (postgres, redis, api, worker) |
| `.env.example` | Variables d'environnement |
| `apps/api/src/**` | Code API existant (patterns à suivre) |
| `docs/frontend-design-choices.md` | Points de design à trancher et recommandations |
| `apps/web/design-tokens.ts` | Charte graphique complète (couleurs, typographie, spacing, etc.) |

---

## Résumé des phases frontend

| Phase | Nom | Correspondance backend | Endpoints clés | Statut |
|---|---|---|---|---|
| 0 | Socle technique | Phase 0 | — | À faire |
| 1 | Auth pages | Phase 3.1 | `/auth/*` | À faire |
| 2 | Recherche & navigation | Phase 3.3, 3.4 | `/titles/search`, `/people/search` | À faire |
| 3 | Pages de détail | Phase 3.3-3.6 | `/titles/:id`, `/people/:id`, `/episodes/:id` | À faire |
| 4.1 | Watches + calendrier | Phase 4.1 | `/watches`, `/calendar`, `/follows` | À faire |
| 4.2 | Ratings | Phase 4.2 | `/ratings`, `/titles/:id/ratings` | À faire |
| 4.3 | Lists | Phase 4.3 | `/lists`, `/shared-lists` | À faire |
| 4.4 | Follows | Phase 4.4 | `/follows` | À faire |
| 5 | Recommandations | Phase 5 | `/admin/compute-recommendations` | À faire |
| 6 | Dataviz + admin refresh | Phase 6.1, 6.2 | `/dataviz/watch-time`, `/dataviz/watch-count`, `/admin/refresh-materialized-views` | À faire |
| 7 | Notifications | Phase 7 | `/notifications` | À faire |
| 8 | Profil | Phase 3.2 | `/users/me` | À faire |
| 9 | Optimisations | — | — | À faire |

---

*Dernière mise à jour : 23 juillet 2026*
*Basé sur : `emdb_roadmap_backend.md` (v2), `packages/db/sql/db_init.sql` (v2), `README.md`, `docs/phase-*.md`*
