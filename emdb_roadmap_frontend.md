# Roadmap Frontend — eMDB (movie/serie tracker)

Basé sur `README.md`, `emdb_roadmap_backend.md` et `packages/db/sql/db_init.sql` (schéma v2 finalisé).

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
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   └── loading.tsx
│       ├── components/
│       │   ├── ui/           # shadcn/ui (générés)
│       │   ├── layout/       # Header, Sidebar, Footer
│       │   ├── titles/       # TitleCard, TitlePoster, TitleSearchBar
│       │   ├── people/       # PersonCard, PersonBadge
│       │   ├── seasons/      # SeasonCard, EpisodeRow
│       │   ├── watches/      # WatchButton, WatchHistoryItem
│       │   ├── ratings/      # RatingInput, RatingBadge
│       │   ├── lists/        # ListCard, ListItem, ListShareDialog
│       │   ├── dataviz/      # WatchTimeChart, WatchCountChart
│       │   └── common/       # ErrorBoundary, LoadingSpinner, Pagination
│       ├── hooks/
│       │   ├── api/          # useTitles, usePeople, useWatches, useRatings, useLists
│       │   ├── auth/         # useAuth, useLogin, useRegister
│       │   ├── ui/           # useDebounce, useLocalStorage, useMediaQuery
│       │   └── dataviz/      # useWatchTime, useWatchCount
│       ├── lib/
│       │   ├── api/          # apiClient (React Query + fetch wrapper)
│       │   ├── auth/         # authClient (login, register, refresh)
│       │   ├── utils/        # formatDate, formatDuration, slugify
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

- [ ] `npx create-next-app@latest apps/web --ts --tailwind` dans le monorepo
- [ ] Configurer `tsconfig.json` pour le path alias `@/` → `./`
- [ ] Configurer `next.config.js` :
  - `output: 'standalone'` (pour Docker/Vercel)
  - `images: { remotePatterns: [{ hostname: 'image.tmdb.org' }] }` (affiches TMDB)
  - `images: { remotePatterns: [{ hostname: 'media.tenor.com' }] }` (GIFs éventuels)
- [ ] Configurer `tailwind.config.js` :
  - shadcn/ui setup (`npx shadcn-ui@latest init`)
  - Thème sombre/light avec `class` strategy
  - Couleurs personnalisées (primary, secondary, accent)
- [ ] Configurer `.eslintrc` + `.prettierrc` (hérité du monorepo)
- [ ] Scripts npm : `dev`, `build`, `start`, `lint`, `test`, `test:e2e`

### 0.2 Client API & React Query

- [ ] `lib/api/apiClient.ts` — wrapper fetch avec :
  - Base URL depuis `NEXT_PUBLIC_API_URL` (`.env.local`)
  - Intercepteur pour rafraîchir le token JWT (via `/auth/refresh`)
  - Gestion des erreurs (401 → redirect login, 403 → forbidden page, 404 → not found)
  - Timeout configurable (10s)
- [ ] `lib/api/queryClient.ts` — configuration globale de React Query :
  - `staleTime: 5 * 60 * 1000` (5 min)
  - `cacheTime: 10 * 60 * 1000` (10 min)
  - `retry: 1` (pas de retry sur 4xx)
  - `refetchOnWindowFocus: true` (rafraîchir à la réactivation)
- [ ] `lib/api/types.ts` — types TypeScript partagés :
  - `Title`, `Person`, `Episode`, `Season`, `Credit`, `Genre`, `Country`
  - `User`, `UserRating`, `UserWatch`, `UserList`, `ListShare`
  - `PaginationResult<T>`, `ApiResponse<T>`

### 0.3 Auth context & store

- [ ] `store/authStore.ts` — Zustand store :
  - `user: AuthenticatedUser | null`
  - `accessToken: string | null`
  - `isAuthenticated: boolean`
  - `isLoading: boolean`
  - Actions : `login()`, `register()`, `logout()`, `refreshToken()`, `fetchCurrentUser()`
- [ ] `hooks/auth/useAuth()` — hook pour accéder au store
- [ ] `hooks/auth/useLogin()` — mutation React Query pour `/auth/login`
- [ ] `hooks/auth/useRegister()` — mutation React Query pour `/auth/register`
- [ ] Middleware Next.js `middleware.ts` :
  - Vérifier le token JWT à chaque navigation
  - Rediriger vers `/login` si non authentifié (pour les routes protégées)
  - Rafraîchir le token si expiré
  - Routes publiques : `/`, `/login`, `/register`, `/titles/:id`, `/people/:id`

### 0.4 Layout & composants de base

- [ ] `components/layout/Header.tsx` — navigation responsive :
  - Logo eMDB
  - Liens : Accueil, Recherche, Calendrier, Mes listes, Dataviz, Notifications
  - Bouton connexion/déconnexion
  - Toggle thème sombre/light
  - Menu mobile (hamburger)
- [ ] `components/layout/Sidebar.tsx` — sidebar desktop (optionnel)
- [ ] `components/layout/Footer.tsx` — footer minimal
- [ ] `components/common/LoadingSpinner.tsx` — spinner réutilisable
- [ ] `components/common/ErrorBoundary.tsx` — boundary pour les erreurs React
- [ ] `components/common/Pagination.tsx` — pagination avec `PaginationResult<T>`
- [ ] `app/loading.tsx` — loading global
- [ ] `app/error.tsx` — error global
- [ ] `app/not-found.tsx` — page 404

### 0.5 Tests

- [ ] Config Jest + React Testing Library (`jest.config.js`, `jest.setup.ts`)
- [ ] Config Cypress (`cypress.config.ts`, `cypress/e2e/`, `cypress/fixtures/`)
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
  - Lien "Mot de passe oublié" (future phase)
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
  - "Voir tous les résultats" → liste complète
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
