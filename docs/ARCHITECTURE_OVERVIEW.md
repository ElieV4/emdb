# eMDB - Architecture & Modules Overview

*Documentation synthétique à destination des Chefs de Projet Data / Product Owners*
*Dernière mise à jour : 24 juillet 2026*

---

## 📋 Table des Matières

1. [Vue d'Ensemble](#-vue-densemble)
2. [Architecture Technique](#-architecture-technique)
3. [Frontend (Next.js)](#-frontend-nextjs)
4. [Organisation du Dépôt](#-organisation-du-dépôt)
5. [Modules Fonctionnels](#-modules-fonctionnels)
6. [Flux de Données](#-flux-de-données)
7. [Dépendances Inter-Modules](#-dépendances-inter-modules)
8. [Points Clés pour la Data](#-points-clés-pour-la-data)

📌 *Pour les détails techniques (fichiers sources, tests) : voir [TECHNICAL_DETAILS.md](./TECHNICAL_DETAILS.md)*

---

## 🎯 Vue d'Ensemble

eMDB est une application de **tracking de films et séries** avec des fonctionnalités avancées de recommandation, dataviz et suivi personnalisé. L'application suit une architecture **monorepo** avec séparation claire entre :

- **API REST** (NestJS) : Expose toutes les fonctionnalités métier
- **Worker** (BullMQ + Redis) : Gère les tâches asynchrones et planifiées
- **Packages partagés** : Logique métier réutilisable (clients API, mappers, sync)
- **Base de données** (PostgreSQL) : Stockage principal avec vues matérialisées pour la dataviz

---

## 🏗️ Architecture Technique

### Stack Technique

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| **Backend API** | Node.js + TypeScript + NestJS | API REST principale |
| **ORM** | Prisma | Accès base de données type-safe |
| **Base de données** | PostgreSQL | Stockage persistant + fonctions PL/pgSQL |
| **Cache & Files** | Redis + BullMQ | Cache API TMDB + gestion des jobs |
| **Worker** | BullMQ + Redis | Tâches asynchrones (import, refresh, notifications) |
| **Conteneurisation** | Docker Compose | Environnement de développement |

### Schéma d'Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React/Next.js)                      │
└───────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API REST (NestJS)                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │   Auth      │ │   Users     │ │   Titles    │ │   People   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │  Watches    │ │  Ratings    │ │   Lists     │ │  Dataviz   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
│  ┌─────────────┐ ┌─────────────┐                                 │
│  │  Notifs     │ │ Recommender │                                 │
│  └─────────────┘ └─────────────┘                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Prisma ORM (packages/db)                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                    │               │               │
                    ▼               ▼               ▼
        ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
        │ PostgreSQL     │ │   Redis       │ │   TMDB API    │
        │ (Données)      │ │ (Cache/Jobs)  │ │ (External)    │
        └───────────────┘ └───────────────┘ └───────────────┘
                    │               │
                    ▼               ▼
        ┌─────────────────────────────────────────────────────────┐
        │                    WORKER (BullMQ)                         │
        │  - Import TMDB batch                                      │
        │  - Refresh données périodiques                            │
        │  - Calcul recommandations                                 │
        │  - Génération notifications                               │
        │  - Nettoyage notifications                                │
        └─────────────────────────────────────────────────────────┘
```

---

## 🖥️ Frontend (Next.js)

> *Application web qui consomme l'API backend eMDB*

### Stack Technique Frontend

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| **Framework** | Next.js 14+ (App Router) | SSR/SSG, routing déclaratif, API routes |
| **Langage** | TypeScript | Typage end-to-end avec le backend |
| **UI/Styling** | Tailwind CSS + shadcn/ui + Radix UI | Composants accessibles, thème sombre/light |
| **Dataviz** | Recharts | Graphiques interactifs (barres, lignes, pie charts) |
| **State Management** | Zustand (global) + React Context (auth) | Gestion d'état légère, sans boilerplate |
| **API Client** | React Query (TanStack Query) | Cache, mutations, refetch automatique |
| **Auth** | JWT via httpOnly cookies | Sécurité (pas de token dans localStorage) |
| **Tests** | Jest + React Testing Library (unit) + Cypress (e2e) | Couverture complète |
| **Hébergement** | Vercel | Déploiement automatique depuis GitHub |

### Architecture Frontend

```
apps/web/
├── app/                    # Pages & routes (App Router)
│   ├── (auth)/            # Pages d'authentification
│   │   ├── login/
│   │   └── register/
│   ├── (titles)/          # Pages titres
│   │   ├── [id]/
│   │   └── search/
│   ├── (people)/          # Pages personnes
│   │   └── [id]/
│   ├── calendar/          # Calendrier épisodes non vus
│   ├── dataviz/           # Visualisation données
│   ├── lists/             # Listes personnalisées
│   ├── notifications/     # Notifications
│   ├── profile/           # Profil utilisateur
│   └── admin/             # Pages administrateur
│
├── components/            # Composants React
│   ├── ui/                # shadcn/ui (composants de base)
│   ├── layout/            # Header, Sidebar, Footer
│   ├── titles/           # TitleCard, TitleSearchBar, etc.
│   ├── people/           # PersonCard, Filmography
│   ├── watches/          # WatchButton, ProgressSerie
│   ├── ratings/          # RatingInput, RatingSummary
│   ├── lists/            # ListCard, ListReorder
│   ├── dataviz/          # Graphiques Recharts
│   ├── notifications/    # NotificationItem, NotificationsBadge
│   └── common/           # LoadingSpinner, ErrorBoundary
│
├── hooks/                # Hooks personnalisés
│   ├── api/               # useTitles, usePeople, useWatches...
│   ├── auth/              # useAuth, useLogin, useRegister
│   └── dataviz/           # useWatchTime, useWatchCount
│
├── lib/                  # Utilities & API clients
│   ├── api/               # apiClient (React Query + fetch wrapper)
│   ├── auth/              # authClient (login, register, refresh)
│   ├── utils/             # formatDate, formatDuration...
│   └── types/             # TypeScript types partagés
│
├── store/                # Zustand stores
│   ├── authStore.ts       # État utilisateur
│   └── uiStore.ts         # Thème, sidebar, etc.
│
└── styles/               # Styles globaux
    ├── globals.css
    └── theme.css
```

### Intégration Backend ↔ Frontend

- **Tous les endpoints backend** sont consommés via **React Query** avec :
  - Cache intelligent (staleTime: 5min, cacheTime: 10min)
  - Refetch automatique (window focus, network reconnect)
  - Mutations optimistes pour les actions utilisateur

- **Authentification** :
  - JWT stocké en **httpOnly cookie** (sécurité maximale)
  - Middleware Next.js pour protéger les routes
  - Rafraîchissement automatique du token
  - Routes publiques : `/`, `/login`, `/register`, `/titles/:id`, `/people/:id`

- **Données** :
  - Mapping direct des types TypeScript backend → frontend
  - Types partagés via `@emdb/db` (Prisma generated types)
  - Transformation des données pour Recharts (dataviz)

### Documentation Complète Frontend

Pour tous les détails sur le frontend (phases, composants, hooks, tests) :
→ [Roadmap Frontend Complete](../emdb_roadmap_frontend.md)

---

## 📁 Organisation du Dépôt

```
emdb/
├── apps/
│   ├── api/                    # API REST NestJS (endpoint principal)
│   │   ├── src/
│   │   │   ├── auth/           # Authentification (JWT)
│   │   │   ├── users/          # Gestion des utilisateurs
│   │   │   ├── titles/         # Films & séries (CRUD + recherche)
│   │   │   ├── people/         # Personnes (acteurs, réalisateurs...)
│   │   │   ├── seasons-episodes/# Gestion saisons & épisodes
│   │   │   ├── credits/        # Casting & crew
│   │   │   ├── watches/        # Visionnages utilisateur
│   │   │   ├── ratings/        # Notations utilisateur
│   │   │   ├── lists/          # Listes personnalisées
│   │   │   ├── dataviz/        # Visualisation données (vues matérialisées)
│   │   │   ├── notifications/  # Notifications utilisateur (Phase 7.1)
│   │   │   ├── admin/          # Endpoints administrateurs
│   │   │   ├── recommender/    # Module recommandations (Phase 5.2)
│   │   │   │   ├── recommender.module.ts
│   │   │   │   ├── recommender.controller.ts
│   │   │   │   ├── recommender.service.ts
│   │   │   │   ├── recommender.config.ts
│   │   │   │   └── dto/
│   │   │   │       ├── compute-recs.dto.ts
│   │   │   │       └── job-status.dto.ts
│   │   │   └── common/         # Code partagé (Prisma, Guards...)
│   │   └── ...
│   │
│   └── worker/                # Worker asynchrone (BullMQ)
│       ├── src/
│       │   ├── index.ts           # Point d'entrée
│       │   ├── worker.ts          # Jobs TMDB + cron + notifications
│       │   ├── recommendations.worker.ts  # Worker recommandations (Phase 5.2)
│       │   ├── cron.ts            # Planification mensuelle recommandations
│       │   └── worker.spec.ts     # Tests
│       └── Dockerfile
│
├── packages/
│   ├── db/                    # Package Base de Données
│   │   ├── src/
│   │   │   ├── schema.prisma  # Schéma Prisma (tables, relations)
│   │   │   ├── functions.ts   # Appels SQL bruts (vues, fonctions PL/pgSQL)
│   │   │   └── ...
│   │   └── migrations/        # Migrations Prisma
│   │
│   ├── tmdb-client/           # Client API TMDB
│   │   └── src/
│   │       └── tmdbClient.ts  # Wrapper HTTP + rate limiting + cache
│   │
│   ├── tmdb-mapper/           # Mapping TMDB → Modèle Interne
│   │   └── src/
│   │       └── index.ts       # Fonctions de mapping
│   │
│   ├── tmdb-sync/             # Synchronisation TMDB
│   │   └── src/
│   │       └── index.ts       # Orchestration import/refresh + notifications
│   │
│   └── wikidata-client/       # Client Wikidata (résolution IDs)
│       └── src/
│           └── index.ts
│
│   └── recommender/           # Algorithme de recommandation (Phase 5.1 + 5.2)
│       ├── src/
│       │   ├── index.ts       # Exports principaux
│       │   ├── jaccard.ts      # Utilitaires Jaccard
│       │   └── recommender.ts  # Algorithme de similarité
│       └── scripts/
│           └── run-recommendations.ts  # CLI pour calcul
│
├── docs/                      # Documentation
│   ├── phase-*.md             # Documentation technique par phase
│   └── ARCHITECTURE_OVERVIEW.md # Ce document
│
├── scripts/                   # Scripts utilitaires
│   └── db_init_v3.sql         # Schéma SQL complet (référence)
│
├── docker-compose.yml         # Configuration Docker
├── package.json              # Dépendances racine
└── README.md                  # Documentation générale
```

---

## Modules Fonctionnels

### Module 1: Authentification (`apps/api/src/auth/`)

| Élément | Type | Description |
|---------|------|-------------|
| `auth.module.ts` | Module NestJS | Module principal |
| `auth.controller.ts` | Controller | Endpoints: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` |
| `auth.service.ts` | Service | Logique métier (hash bcrypt, JWT) |
| `jwt.strategy.ts` | Strategy | Validation JWT (Passport) |
| `jwt-auth.guard.ts` | Guard | Protection des routes |
| `current-user.decorator.ts` | Decorator | Extraction user depuis JWT |

**Fonctionnalités** :
- Inscription / Connexion (JWT access + refresh tokens)
- Gestion des sessions stateless
- Middleware global (sauf routes publiques)

**Dépendances** :
- `@emdb/db` (Prisma User)
- `bcrypt`, `@nestjs/jwt`, `passport-jwt`

---

### Module 2: Utilisateurs (`apps/api/src/users/`)

| Élément | Type | Description |
|---------|------|-------------|
| `users.module.ts` | Module NestJS | Module principal |
| `users.controller.ts` | Controller | Endpoints: `/users/me`, `/users/search` |
| `users.service.ts` | Service | Gestion CRUD profil |

**Fonctionnalités** :
- CRUD profil utilisateur
- Upload avatar (Multer, validation 5Mo)
- Recherche d'utilisateurs par pseudo/email
- Suppression de compte (cascade FK)

**Dépendances** :
- `@emdb/db` (Prisma User)
- Module `auth` (JwtAuthGuard)

---

### Module 3: Titres (`apps/api/src/titles/`)

| Élément | Type | Description |
|---------|------|-------------|
| `titles.module.ts` | Module NestJS | Module principal |
| `titles.controller.ts` | Controller | Endpoints: `/titles`, `/titles/search`, `/titles/:id`, `/titles/tmdb/:tmdbId` |
| `titles.service.ts` | Service | Gestion films & séries |

**Fonctionnalités** :
- Recherche (proxy TMDB + fusion résultats locaux)
- Détail d'un titre (genres, pays, studios, saisons)
- Import automatique depuis TMDB si absent
- Liste paginée avec filtres (type, genre, pays, animation, note)
- Recommandations (locale TMDB fallback)
- Refresh manuel des données TMDB

**Dépendances** :
- `@emdb/db` (Prisma Title, Genre, Country, TitleGenre)
- `@emdb/tmdb-client` (appels API TMDB)
- `@emdb/tmdb-mapper` (mapping données)
- `@emdb/tmdb-sync` (import automatique)
- Module `auth` (JwtAuthGuard)

---

### Module 4: Personnes (`apps/api/src/people/`)

| Élément | Type | Description |
|---------|------|-------------|
| `people.module.ts` | Module NestJS | Module principal |
| `people.controller.ts` | Controller | Endpoints: `/people`, `/people/search`, `/people/:id`, `/people/tmdb/:tmdbId` |
| `people.service.ts` | Service | Gestion acteurs/réalisateurs |

**Fonctionnalités** :
- Recherche de personnes (TMDB + local)
- Détail personne (bio, photo, wiki_url, pays)
- Filmographie (credits → titles groupés par rôle)
- Recommandations de personnes similaires
- Import automatique depuis TMDB

**Dépendances** :
- `@emdb/db` (Prisma Person, Credit, PersonExternalId)
- `@emdb/tmdb-client`
- `@emdb/tmdb-mapper`
- `@emdb/tmdb-sync`
- `@emdb/wikidata-client` (résolution wiki_url)
- Module `auth` (JwtAuthGuard)

---

### Module 5: Saisons & Épisodes (`apps/api/src/seasons-episodes/`)

| Élément | Type | Description |
|---------|------|-------------|
| `seasons-episodes.module.ts` | Module NestJS | Module principal |
| `seasons-episodes.controller.ts` | Controller | Endpoints: `/titles/:titleId/seasons`, `/episodes/:id` |
| `seasons-episodes.service.ts` | Service | Gestion hiérarchie |

**Fonctionnalités** :
- Liste des saisons d'une série
- Détail d'une saison avec épisodes
- Détail d'un épisode avec saison parente
- Credits spécifiques à un épisode

**Dépendances** :
- `@emdb/db` (Prisma Season, Episode, EpisodeCredit)
- Module `titles` (pour la navigation)
- Module `auth` (JwtAuthGuard)

---

### Module 6: Credits (`apps/api/src/credits/`)

**Fonctionnalités** :
- Liste des credits d'un titre
- Groupement par rôle (acteur, réalisateur, scénariste, autre)
- Ordonnancement selon `order` (pour le cast)

**Dépendances** :
- `@emdb/db` (Prisma Credit, Person)
- Module `titles`
- Module `people`

---

### Module 7: Visionnages (`apps/api/src/watches/`)

**Fonctionnalités** :
- Marquer un titre/épisode comme vu
- Liste des visionnages (filtres par type, date, titre)
- Progression série (`fn_progress_serie` via Prisma `$queryRaw`)
- Calendrier épisodes non vus (`fn_episodes_non_vus` via `$queryRaw`)
- **Suivi de séries (abonnements)** - Phase 4.4 intégrée ici

**Dépendances** :
- `@emdb/db` (Prisma UserWatch, UserFollowsSerie)
- Fonctions PL/pgSQL : `fn_progress_serie`, `fn_episodes_non_vus`
- Module `auth` (JwtAuthGuard)
- Module `titles` (validation type série)

**Note** : Le module Follows (Phase 4.4) est intégré dans Watches pour éviter la duplication et exploiter le couplage naturel avec le calendrier et la progression.

---

### Module 8: Notations (`apps/api/src/ratings/`)

**Fonctionnalités** :
- Notation titre/épisode (0-10, commentaire optionnel)
- Upsert automatique (unique user_id + title_id ou episode_id)
- Liste des notes de l'utilisateur
- Statistiques d'un titre (moyenne, répartition)
- Trigger `trg_user_ratings_updated_at` (mis à jour automatiquement)

**Dépendances** :
- `@emdb/db` (Prisma UserRating)
- Module `auth` (JwtAuthGuard)
- Module `titles` (validation existence)

---

### Module 9: Listes (`apps/api/src/lists/`)

**Fonctionnalités** :
- CRUD listes (watchlist, favoris, custom)
- Ajout/retrait de titres dans une liste
- Réordonnancement batch des items
- Partage de listes avec permissions (lecture/édition)
- Accès aux listes partagées

**Dépendances** :
- `@emdb/db` (Prisma UserList, ListItem, ListShare)
- Module `auth` (JwtAuthGuard)
- Module `users` (recherche utilisateurs à partager)
- Module `titles` (validation titres)

---

### Module 10: Dataviz (`apps/api/src/dataviz/`)

**Fonctionnalités** :
- Statistiques de temps de visionnage (`mv_watch_time_*`)
- Statistiques de nombre de visionnages (`mv_watch_count_*`)
- Groupement par : genre, période, pays, animation
- Filtres par année (yearFrom/yearTo)
- 8 vues matérialisées déjà créées en base

**Vues Matérialisées** :
- `mv_watch_time_by_period`, `mv_watch_time_by_genre`, `mv_watch_time_by_country`, `mv_watch_time_by_animation`
- `mv_watch_count_by_period`, `mv_watch_count_by_genre`, `mv_watch_count_by_country`, `mv_watch_count_by_animation`

**Dépendances** :
- `@emdb/db` (Prisma `$queryRawUnsafe` pour les MV)
- Module `auth` (JwtAuthGuard - données personnelles)

---

### Module 11: Recommender (`apps/api/src/recommender/`)

**Fonctionnalités** :
- Déclenchement manuel du calcul des recommandations (titres + personnes)
- Suivi de job BullMQ (status, progression, résultat)
- Statistiques globales (total recs, dernier run, durée)
- Réservé aux administrateurs

**Endpoints** :
- `POST /admin/compute-recommendations` — Lance le calcul via BullMQ
- `GET /admin/compute-recommendations/:jobId/status` — Statut du job
- `GET /admin/recommendations/stats` — Statistiques globales

**Dépendances** :
- `@emdb/db` (Prisma pour les stats)
- `@emdb/recommender` (algorithme Jaccard)
- BullMQ (queue `recommendations`)
- Module `admin` (AdminGuard via `@UseGuards`)

---

### Module 12: Admin (`apps/api/src/admin/`)

**Fonctionnalités** :
- Déclenchement manuel du refresh des vues matérialisées
- Réservé aux administrateurs

**Dépendances** :
- `@emdb/db`
- BullMQ (pour les jobs asynchrones)
- Module `auth` (JwtAuthGuard + AdminGuard)

---

### Module 13: Notifications (`apps/api/src/notifications/`)

**Fonctionnalités** (Phase 7.1) :
- Consultation des notifications (liste paginée, non lues en priorité)
- Marquage d'une notification comme lue
- Marquage de toutes les notifications comme lues
- Compteur de notifications non lues

**Endpoints** :
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/notifications` | ✅ JWT | Liste paginée des notifications |
| `PATCH` | `/notifications/:id/read` | ✅ JWT | Marquer une notification comme lue |
| `PATCH` | `/notifications/read-all` | ✅ JWT | Tout marquer comme lu |
| `GET` | `/notifications/unread-count` | ✅ JWT | Compteur de non lues |

**Dépendances** :
- `@emdb/db` (Prisma Notification, Episode, Title)
- Module `auth` (JwtAuthGuard)

**Génération** (Phase 7.2) :
- `dailySyncNewEpisodes()` dans tmdb-sync enrichie pour créer des notifications
- Types : `new_episode`, `season_premiere`, `series_return`

**Maintenance** (Phase 7.3) :
- Nettoyage automatique via job BullMQ `clean-notifications`
- Hebdomadaire : suppression des notifications lues de plus de 30 jours
- Mensuel : suppression des notifications non lues de plus de 90 jours

---

### Module 14: Worker (`apps/worker/`)

**Jobs Gérés** :
- `import-title` : Import d'un titre depuis TMDB
- `import-seasons` : Import saisons/épisodes pour une série
- `refresh-title` : Rafraîchissement données TMDB d'un titre
- `daily-sync-new-episodes` : Synchronisation quotidienne (nouveaux épisodes + notifications)
- `weekly-resync-changes` : Resynchronisation hebdomadaire
- `refresh-materialized-views` : Refresh des 8 vues matérialisées
- `compute-recommendations` : Calcul batch des recommandations
- `generate-notifications` : Génération des notifications (Phase 7.2)
- `clean-notifications` : Nettoyage automatique des notifications (Phase 7.3)
  - Hebdomadaire : suppression des notifications lues de plus de 30 jours
  - Mensuel : suppression des notifications non lues de plus de 90 jours

**Fonctionnalités** :
- Traitement asynchrone via Redis + BullMQ
- Rate limiting respecté (40 req/10s pour TMDB)
- Logging et monitoring (Bull Board en dev)
- Cron jobs planifiés

**Dépendances** :
- `@emdb/db` (Prisma)
- `@emdb/tmdb-client`
- `@emdb/tmdb-mapper`
- `@emdb/tmdb-sync`
- `bullmq`, `ioredis`

---

## Flux de Données

### Flux Principal : Import depuis TMDB

```
Frontend → API/titles/search → tmdb-client → tmdb-mapper → tmdb-sync → Base de Données
                              ↓
                      (Rate limiting + Cache Redis)
```

### Flux Utilisateur : Visionnage & Notation

```
Frontend → Auth (JWT) → [watches/POST, ratings/PUT, lists/POST] → Base de Données
```

### Flux Dataviz : Vues Matérialisées

```
Frontend → API/dataviz → $queryRawUnsafe → VUES MATERIALISEES (8) ← Worker (refresh cron 3h)
```

### Flux Notifications : Nouvel Épisode

```
Worker (daily-sync-new-episodes) → tmdb-sync (generateNewEpisodeNotifications) →
  PostgreSQL (notifications) ← API/notifications → Frontend (badge + liste)
```

---

## Dépendances Inter-Modules

### Tableau des Dépendances

| Module | Dépendances Internes | Dépendances Packages |
|--------|----------------------|----------------------|
| auth | - | @emdb/db |
| users | auth | @emdb/db |
| titles | auth | @emdb/db, @emdb/tmdb-client, @emdb/tmdb-mapper, @emdb/tmdb-sync |
| people | auth | @emdb/db, @emdb/tmdb-client, @emdb/tmdb-mapper, @emdb/tmdb-sync, @emdb/wikidata-client |
| seasons-episodes | auth, titles | @emdb/db |
| credits | auth, titles, people | @emdb/db |
| watches | auth, titles | @emdb/db (fonctions PL/pgSQL) |
| ratings | auth, titles | @emdb/db |
| lists | auth, users, titles | @emdb/db |
| dataviz | auth | @emdb/db (vues matérialisées) |
| recommender | admin | @emdb/db, @emdb/recommender, BullMQ |
| admin | auth | @emdb/db, BullMQ |
| **notifications (7.1)** | **auth** | **@emdb/db** |
| worker | - | @emdb/db, @emdb/tmdb-client, @emdb/tmdb-mapper, @emdb/tmdb-sync, BullMQ, Redis |

---

## Points Clés pour la Data

### Schéma de la Base de Données

**40+ tables** organisées en catégories :
- Utilisateurs (users, user_settings)
- Médias (titles, title_genres, title_countries, title_studios)
- Personnes (people, person_external_ids)
- Cast/Crew (credits, episode_credits)
- Séries (seasons, episodes)
- Activité utilisateur (user_watches, user_ratings, user_follows_serie)
- Listes (user_lists, list_items, list_shares)
- **Notifications (notifications)**
- Recommandations (title_recommendations, person_recommendations)
- Logs (tmdb_sync_log)

### Vues Matérialisées (8)

Toutes les vues sont rafraîchies **toutes les 3 heures** via worker avec `REFRESH MATERIALIZED VIEW CONCURRENTLY`.

| Vue | Type | Groupement |
|-----|------|------------|
| `mv_watch_time_by_period` | Temps | Par semaine/mois |
| `mv_watch_time_by_genre` | Temps | Par genre |
| `mv_watch_time_by_country` | Temps | Par pays |
| `mv_watch_time_by_animation` | Temps | Animation vs Live |
| `mv_watch_count_by_period` | Compte | Par période |
| `mv_watch_count_by_genre` | Compte | Par genre |
| `mv_watch_count_by_country` | Compte | Par pays |
| `mv_watch_count_by_animation` | Compte | Animation vs Live |

### Fonctions PL/pgSQL

| Fonction | Utilisation |
|----------|-------------|
| `fn_episodes_non_vus(user_id, title_id)` | Calendrier utilisateur |
| `fn_progress_serie(user_id, title_id)` | Progression par saison |

**Trigger** : `trg_user_ratings_updated_at` → Met à jour `updated_at` automatiquement

### Données Externes

| Source | Package | Cache |
|--------|---------|-------|
| TMDB API v4 | `@emdb/tmdb-client` | Redis (TTL 24h) |
| Wikidata | `@emdb/wikidata-client` | Aucun |
| Calcul local | `@emdb/recommender` | N/A (100% local) |

---

## Récapitulatif par Phase

| Phase | Objectif | Status | Modules Concernés |
|-------|----------|--------|-------------------|
| 0 | Socle technique (monorepo, Docker, Prisma) | ✅ | - |
| 1 | Base de données (schéma + MV + fonctions) | ✅ | packages/db |
| 2 | Intégration TMDB (client + mapping + sync) | ✅ | packages/tmdb-* |
| 3 | API Cœur CRUD | ✅ | auth, users, titles, people, seasons-episodes, credits |
| 4 | Fonctionnalités utilisateur | ✅ | watches, ratings, lists, follows |
| 5 | Recommandations (algorithme maison) | ✅ | recommender (5.1), admin + worker (5.2), fallback (5.3) |
| 6 | Dataviz (vues matérialisées) | ✅ | dataviz, admin |
| **7** | **Notifications** | ✅ | **notifications (7.1 ✅), tmdb-sync + worker (7.2 ✅), worker (7.3 ✅)** |

---

## Points d'Attention Data

1. **Performance MV** : Refresh CONCURRENTLY toutes les 3h, monitoring si >5min
2. **Rate Limiting TMDB** : 40 req/10s, token bucket + queue, cache Redis 24h
3. **Idempotence** : UPSERT basé sur tmdb_id, BullMQ séquentiel
4. **Recommandations** : O(N²), batch 100, cron mensuel, timeout 30min
5. **Sécurité** : JWT (15min/7j), bcrypt, .env jamais commité
6. **Notifications** : Index sur `(user_id, lu, created_at)` pour les requêtes de liste, déduplication par `(episode_id, type)` pour éviter les doublons

---

## Monitoring & Métriques

| Métrique | Source | Seuil |
|----------|--------|-------|
| Taux d'erreur API | Logs | >1% |
| Latence requêtes | Logs | >500ms |
| Durée refresh MV | Worker | >5min |
| Durée calcul recos | Worker | >30min |
| Taille cache Redis | Redis | >1GB |
| Taille DB PostgreSQL | PostgreSQL | >10GB |
| **Notifications générées/jour** | **Worker logs** | **Alerter si 0** |

**Outils** : Bull Board (dev), NestJS Logger, Swagger (/docs)

---

## Lexique

| Terme | Définition |
|-------|------------|
| TMDB | The Movie Database - API externe métadonnées |
| PL/pgSQL | Procedural Language/PostgreSQL |
| MV | Materialized View - Vue pré-calculée |
| Prisma | ORM TypeScript moderne |
| BullMQ | Library jobs asynchrones (Redis) |
| JWT | JSON Web Token - Auth stateless |

---

*Document généré à partir de la roadmap et de l'analyse du code.*
*Pour plus de détails : voir [emdb_roadmap_backend.md](../emdb_roadmap_backend.md)*