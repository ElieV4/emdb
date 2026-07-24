# eMDB - Technical Details (Annexe)

*Documentation technique détaillée - Complément à l'Architecture Overview*
*Dernière mise à jour : 24 juillet 2026*

---

## 📋 Table des Matières

1. [Fichiers Sources par Module](#-fichiers-sources-par-module)
2. [Tests](#-tests)

---

## 📁 Fichiers Sources par Module

### Module 1: Authentification (`apps/api/src/auth/`)

**Structure du module :**
```
auth/
├── auth.controller.ts          # Endpoints REST
├── auth.module.ts             # Configuration du module NestJS
├── auth.service.ts            # Logique métier
├── jwt.strategy.ts            # Stratégie Passport JWT
├── jwt-auth.guard.ts          # Guard de protection des routes
├── decorators/
│   └── current-user.decorator.ts  # Décorateur pour extraire l'utilisateur
└── dto/
    ├── login.dto.ts            # DTO de connexion
    ├── register.dto.ts         # DTO d'inscription
    └── refresh.dto.ts          # DTO de rafraîchissement token
```

**Fichiers sources (10 fichiers) :**
- `auth.controller.ts`
- `auth.module.ts`
- `auth.service.ts`
- `jwt.strategy.ts`
- `jwt-auth.guard.ts`
- `decorators/current-user.decorator.ts`
- `dto/login.dto.ts`
- `dto/register.dto.ts`
- `dto/refresh.dto.ts`

---

### Module 2: Utilisateurs (`apps/api/src/users/`)

**Structure du module :**
```
users/
├── users.controller.ts          # Endpoints REST
├── users.module.ts             # Configuration du module
├── users.service.ts            # Logique métier
└── dto/
    ├── search-users.dto.ts     # DTO de recherche
    ├── update-user.dto.ts      # DTO de mise à jour profil
    └── upload-avatar.dto.ts     # DTO upload avatar
```

**Fichiers sources (7 fichiers) :**
- `users.controller.ts`
- `users.module.ts`
- `users.service.ts`
- `dto/search-users.dto.ts`
- `dto/update-user.dto.ts`
- `dto/upload-avatar.dto.ts`

---

### Module 3: Titres (`apps/api/src/titles/`)

**Structure du module :**
```
titles/
├── titles.controller.ts          # Endpoints REST
├── titles.module.ts             # Configuration du module
├── titles.service.ts            # Logique métier
└── dto/
    ├── import-title.dto.ts      # DTO pour import depuis TMDB
    ├── list-titles-filter.dto.ts # DTO pour filtres de liste
    └── search-titles.dto.ts      # DTO pour recherche
```

**Fichiers sources (7 fichiers) :**
- `titles.controller.ts`
- `titles.module.ts`
- `titles.service.ts`
- `dto/import-title.dto.ts`
- `dto/list-titles-filter.dto.ts`
- `dto/search-titles.dto.ts`

---

### Module 4: Personnes (`apps/api/src/people/`)

**Structure du module :**
```
people/
├── people.controller.ts          # Endpoints REST
├── people.module.ts             # Configuration du module
├── people.service.ts            # Logique métier
└── dto/
    └── search-people.dto.ts      # DTO pour recherche
```

**Fichiers sources (5 fichiers) :**
- `people.controller.ts`
- `people.module.ts`
- `people.service.ts`
- `dto/search-people.dto.ts`

---

### Module 5: Saisons & Épisodes (`apps/api/src/seasons-episodes/`)

**Structure du module :**
```
seasons-episodes/
├── seasons-episodes.controller.ts  # Endpoints REST
├── seasons-episodes.module.ts     # Configuration du module
└── seasons-episodes.service.ts    # Logique métier
```

**Fichiers sources (3 fichiers) :**
- `seasons-episodes.controller.ts`
- `seasons-episodes.module.ts`
- `seasons-episodes.service.ts`

---

### Module 6: Credits (`apps/api/src/credits/`)

**Structure du module :**
```
credits/
├── credits.controller.ts    # Endpoints REST
├── credits.module.ts       # Configuration du module
└── credits.service.ts      # Logique métier
```

**Fichiers sources (3 fichiers) :**
- `credits.controller.ts`
- `credits.module.ts`
- `credits.service.ts`

---

### Module 7: Visionnages (`apps/api/src/watches/`)

**Structure du module :**
```
watches/
├── watches.controller.ts          # Endpoints REST
├── watches.module.ts             # Configuration du module
├── watches.service.ts            # Logique métier
└── dto/
    ├── create-watch.dto.ts        # DTO pour créer un visionnage
    ├── follow-serie.dto.ts        # DTO pour suivre une série
    └── list-watches-filter.dto.ts  # DTO pour filtres
```

**Fichiers sources (7 fichiers) :**
- `watches.controller.ts`
- `watches.module.ts`
- `watches.service.ts`
- `dto/create-watch.dto.ts`
- `dto/follow-serie.dto.ts`
- `dto/list-watches-filter.dto.ts`

---

### Module 8: Notations (`apps/api/src/ratings/`)

**Structure du module :**
```
ratings/
├── ratings.controller.ts          # Endpoints REST
├── ratings.module.ts             # Configuration du module
├── ratings.service.ts            # Logique métier
└── dto/
    ├── list-ratings-filter.dto.ts  # DTO pour filtres
    └── upsert-rating.dto.ts        # DTO pour upsert notation
```

**Fichiers sources (6 fichiers) :**
- `ratings.controller.ts`
- `ratings.module.ts`
- `ratings.service.ts`
- `dto/list-ratings-filter.dto.ts`
- `dto/upsert-rating.dto.ts`

---

### Module 9: Listes (`apps/api/src/lists/`)

**Structure du module :**
```
lists/
├── lists.controller.ts           # Endpoints REST
├── lists.module.ts              # Configuration du module
├── lists.service.ts             # Logique métier
└── dto/
    ├── add-item.dto.ts           # DTO pour ajouter un item
    ├── create-list.dto.ts        # DTO pour créer une liste
    ├── reorder.dto.ts             # DTO pour réordonner
    ├── share-list.dto.ts          # DTO pour partager
    └── update-list.dto.ts         # DTO pour mettre à jour
```

**Fichiers sources (10 fichiers) :**
- `lists.controller.ts`
- `lists.module.ts`
- `lists.service.ts`
- `dto/add-item.dto.ts`
- `dto/create-list.dto.ts`
- `dto/reorder.dto.ts`
- `dto/share-list.dto.ts`
- `dto/update-list.dto.ts`

---

### Module 10: Dataviz (`apps/api/src/dataviz/`)

**Structure du module :**
```
dataviz/
├── dataviz.controller.ts          # Endpoints REST
├── dataviz.module.ts             # Configuration du module
├── dataviz.service.ts            # Logique métier
└── dto/
    ├── watch-count-query.dto.ts   # DTO pour requêtes count
    └── watch-time-query.dto.ts    # DTO pour requêtes time
```

**Fichiers sources (7 fichiers) :**
- `dataviz.controller.ts`
- `dataviz.module.ts`
- `dataviz.service.ts`
- `dto/watch-count-query.dto.ts`
- `dto/watch-time-query.dto.ts`

---

### Module 11: Recommender (`apps/api/src/recommender/`)

**Structure du module :**
```
recommender/
├── recommender.module.ts       # Configuration du module NestJS
├── recommender.controller.ts   # Endpoints REST (3 endpoints)
├── recommender.service.ts      # Logique métier (BullMQ + stats)
├── recommender.config.ts       # Configuration BullMQ partagée
└── dto/
    ├── compute-recs.dto.ts     # DTO pour POST compute-recommendations
    └── job-status.dto.ts       # DTO pour réponse status job
```

**Fichiers sources (7 fichiers) :**
- `recommender.module.ts`
- `recommender.controller.ts`
- `recommender.service.ts`
- `recommender.config.ts`
- `dto/compute-recs.dto.ts`
- `dto/job-status.dto.ts`

---

### Module 12: Admin (`apps/api/src/admin/`)

**Structure du module :**
```
admin/
├── admin.controller.ts    # Endpoints REST
├── admin.module.ts       # Configuration du module
├── admin.service.ts      # Logique métier
└── admin.guard.ts        # Guard administrateur
```

**Fichiers sources (4 fichiers) :**
- `admin.controller.ts`
- `admin.module.ts`
- `admin.service.ts`
- `admin.guard.ts`

---

### Module 13: Worker (`apps/worker/`)

**Structure du module :**
```
worker/
├── src/
│   ├── index.ts                   # Point d'entrée
│   ├── worker.ts                  # Jobs TMDB + cron
│   ├── recommendations.worker.ts  # Worker recommandations (Phase 5.2)
│   ├── cron.ts                    # Planification mensuelle recommandations
│   └── worker.spec.ts             # Tests
└── Dockerfile
```

**Fichiers sources (6 fichiers) :**
- `src/index.ts`
- `src/worker.ts`
- `src/recommendations.worker.ts`
- `src/cron.ts`
- `src/worker.spec.ts`
- `Dockerfile`

---

### Module 13: Common (`apps/api/src/common/`)

**Structure du module :**
```
common/
├── filters/
│   └── prisma-exception.filter.ts  # Filtre d'exceptions Prisma
└── prisma/
    ├── prisma.module.ts         # Module Prisma
    └── prisma.service.ts        # Service Prisma
```

**Fichiers sources (3 fichiers) :**
- `filters/prisma-exception.filter.ts`
- `prisma/prisma.module.ts`
- `prisma/prisma.service.ts`

---

### Packages Partagés

#### Package: `@emdb/db` (`packages/db/`)

**Structure :**
```
db/
├── src/
│   ├── schema.prisma          # Schéma Prisma
│   └── functions.ts           # Fonctions SQL brutes
└── migrations/                # Migrations Prisma
```

**Fichiers principaux :**
- `src/schema.prisma`
- `src/functions.ts`

---

#### Package: `@emdb/tmdb-client` (`packages/tmdb-client/`)

**Structure :**
```
tmdb-client/
└── src/
    ├── index.ts               # Export principal
    └── tmdbClient.ts           # Client TMDB complet
```

**Fichiers principaux :**
- `src/index.ts`
- `src/tmdbClient.ts`

---

#### Package: `@emdb/tmdb-mapper` (`packages/tmdb-mapper/`)

**Structure :**
```
tmdb-mapper/
└── src/
    ├── index.ts               # Export principal
    └── index.spec.ts          # Tests
```

**Fichiers principaux :**
- `src/index.ts`
- `src/index.spec.ts`

---

#### Package: `@emdb/tmdb-sync` (`packages/tmdb-sync/`)

**Structure :**
```
tmdb-sync/
└── src/
    ├── index.ts               # Export principal
    └── index.spec.ts          # Tests
```

**Fichiers principaux :**
- `src/index.ts`
- `src/index.spec.ts`

---

#### Package: `@emdb/wikidata-client` (`packages/wikidata-client/`)

**Structure :**
```
wikidata-client/
└── src/
    ├── index.ts               # Export principal
    └── index.spec.ts          # Tests
```

**Fichiers principaux :**
- `src/index.ts`
- `src/index.spec.ts`

---

#### Package: `@emdb/recommender` (`packages/recommender/`)

**Structure :**
```
recommender/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Exports principaux
│   ├── jaccard.ts            # Utilitaires Jaccard
│   ├── recommender.ts        # Algorithme de similarité
│   └── recommender.spec.ts    # Tests unitaires (12 tests)
└── scripts/
    └── run-recommendations.ts # CLI pour calcul
```

**Fichiers principaux :**
- `src/index.ts` - Exports `computeTitleRecommendations`, `computePersonRecommendations`, `computeAllRecommendations`, `computeRecommendationsForTitle`
- `src/jaccard.ts` - Fonctions `jaccardSimilarity`, `hasCommonElement`, `hasCommonGenre`
- `src/recommender.ts` - Algorithme principal avec similarité Jaccard pondérée
- `scripts/run-recommendations.ts` - Script CLI avec options `--mode`, `--batch`, `--title-id`

**Dépendances :**
- `@emdb/db` (Prisma) - Seul dépendance, pas d'appels réseau

**Tests unitaires :**
- 12 tests dans `recommender.spec.ts`
- Couverture complète des utilitaires Jaccard
- Tests de similarité, intersection, sets vides

---

---

## 🧪 Tests

### Vue d'Ensemble des Tests

| Type de Test | Nombre | Localisation | Couverture | Validation |
|--------------|---------|--------------|------------|------------|
| **Unitaires** | 16 | `*.service.spec.ts` | ~80-95% | Jest + Mocking |
| **Intégration** | 4 | Fichiers dédiés | ~70-80% | Prisma + Services |
| **E2E** | 1 | `e2e.spec.ts` | ~60-70% | Supertest + API |
| **Fonctions PL/pgSQL** | 2 | Tests dédiés | ~100% | Appels `$queryRaw` |
| **Contraintes DB** | 1 | `db-constraints.spec.ts` | N/A | Validation schema |

---

### Fichiers de Tests par Module

#### Tests Unitaires (Service Layer)

| Module | Fichier de Test | Taille | Statut |
|--------|----------------|-------|--------|
| Auth | `apps/api/src/auth/auth.service.spec.ts` | 2.1 Ko | ✅ Implémenté |
| Users | `apps/api/src/users/users.service.spec.ts` | 5.4 Ko | ✅ Implémenté |
| Titles | `apps/api/src/titles/titles.service.spec.ts` | 8.2 Ko | ✅ Implémenté |
| People | `apps/api/src/people/people.service.spec.ts` | 10.1 Ko | ✅ Implémenté |
| Credits | `apps/api/src/credits/credits.service.spec.ts` | 3.4 Ko | ✅ Implémenté |
| Seasons-Episodes | `apps/api/src/seasons-episodes/seasons-episodes.service.spec.ts` | 7.7 Ko | ✅ Implémenté |
| Watches | `apps/api/src/watches/watches.service.spec.ts` | 15.6 Ko | ✅ Implémenté |
| Ratings | `apps/api/src/ratings/ratings.service.spec.ts` | 13.4 Ko | ✅ Implémenté |
| Lists | `apps/api/src/lists/lists.service.spec.ts` | 24.3 Ko | ✅ Implémenté |
| Dataviz | `apps/api/src/dataviz/dataviz.service.spec.ts` | 8.1 Ko | ✅ Implémenté |
| Recommender | `apps/api/src/recommender/recommender.service.spec.ts` | 4.8 Ko | ✅ Implémenté |
| Admin | `apps/api/src/admin/admin.service.spec.ts` | 3.2 Ko | ✅ Implémenté |
| Worker | `apps/worker/src/worker.spec.ts` | 1.8 Ko | ✅ Implémenté |

#### Tests d'Intégration

| Type | Fichier | Description |
|------|--------|-------------|
| Fonctions PL/pgSQL | `apps/api/src/plpgsql-functions.spec.ts` | Tests des fonctions PostgreSQL via `$queryRaw` |
| Contraintes DB | `apps/api/src/db-constraints.spec.ts` | Validation des contraintes unique, foreign keys |

#### Tests E2E

| Fichier | Description |
|--------|-------------|
| `apps/api/src/e2e.spec.ts` | Tests end-to-end de l'API REST |

#### Tests Packages

| Package | Fichier | Description |
|---------|--------|-------------|
| tmdb-mapper | `packages/tmdb-mapper/src/index.spec.ts` | Tests de mapping TMDB → modèle interne |
| tmdb-sync | `packages/tmdb-sync/src/index.spec.ts` | Tests d'orchestration d'import |
| wikidata-client | `packages/wikidata-client/src/index.spec.ts` | Tests du client Wikidata |

---

### Détail des Tests par Module

#### Module Auth
- **Fichier** : `auth.service.spec.ts` (2.1 Ko)
- **Tests effectués** :
  - Hashing bcrypt (register)
  - Validation JWT (login)
  - Génération tokens (access + refresh)
  - Validation tokens expirés
  - Gestion des erreurs (wrong password, user not found)
- **Mocks utilisés** : `bcrypt`, `@nestjs/jwt`, `PrismaService`
- **Couverture** : ~90%

#### Module Users
- **Fichier** : `users.service.spec.ts` (5.4 Ko)
- **Tests effectués** :
  - CRUD utilisateur
  - Update profil (pseudo, avatar_url)
  - Recherche par pseudo/email
  - Suppression avec cascade
- **Mocks utilisés** : `PrismaService`
- **Couverture** : ~85%

#### Module Titles
- **Fichier** : `titles.service.spec.ts` (8.2 Ko)
- **Tests effectués** :
  - Recherche locale + fusion TMDB
  - Get/import par tmdbId
  - Liste paginée avec filtres
  - Get par ID
  - Refresh données
- **Mocks utilisés** : `PrismaService`, `TmdbSyncService`, `TmdbClient`
- **Couverture** : ~88%

#### Module People
- **Fichier** : `people.service.spec.ts` (10.1 Ko)
- **Tests effectués** :
  - Recherche locale + fusion TMDB
  - Get/import par tmdbId
  - Get par ID avec filmographie
  - Get recommendations
  - Refresh données
- **Mocks utilisés** : `PrismaService`, `TmdbSyncService`, `TmdbClient`, `WikidataClient`
- **Couverture** : ~90%

#### Module Credits
- **Fichier** : `credits.service.spec.ts` (3.4 Ko)
- **Tests effectués** :
  - Get credits par titleId
  - Groupement par rôle (acteur, réalisateur, scénariste, autre)
  - Ordonnancement par `order`
- **Mocks utilisés** : `PrismaService`
- **Couverture** : ~80%

#### Module Seasons-Episodes
- **Fichier** : `seasons-episodes.service.spec.ts` (7.7 Ko)
- **Tests effectués** :
  - Get saisons par titleId
  - Get saison par numéro avec épisodes
  - Get épisode par ID
  - Get credits épisode
- **Mocks utilisés** : `PrismaService`
- **Couverture** : ~82%

#### Module Watches
- **Fichier** : `watches.service.spec.ts` (15.6 Ko)
- **Tests effectués** :
  - Create watch (title ou episode)
  - Delete watch
  - List watches avec filtres
  - Get progression série (appel `fn_progress_serie`)
  - Get calendrier épisodes non vus (appel `fn_episodes_non_vus`)
  - Follow/unfollow série
  - List séries suivies
- **Note** : Le module Watches intègre également la fonctionnalité Follows (Phase 4.4) pour le suivi de séries, avec les endpoints dédiés et DTOs spécifiques (`follow-serie.dto.ts`)
- **Mocks utilisés** : `PrismaService` (avec `$queryRaw` mocké)
- **Couverture** : ~92%

#### Module Ratings
- **Fichier** : `ratings.service.spec.ts` (13.4 Ko)
- **Tests effectués** :
  - Upsert rating (title ou episode)
  - Delete rating
  - List user ratings
  - Get title ratings summary (moyenne, répartition)
- **Mocks utilisés** : `PrismaService`
- **Couverture** : ~90%

#### Module Lists
- **Fichier** : `lists.service.spec.ts` (24.3 Ko)
- **Tests effectués** :
  - Create list
  - Get user lists
  - Get list detail avec items
  - Update list
  - Delete list (avec cascade)
  - Add/remove item
  - Reorder items (batch)
  - Share/unshare list
  - Get shared lists
  - Vérification permissions
- **Mocks utilisés** : `PrismaService`
- **Couverture** : ~95% (le plus testé)

#### Module Dataviz
- **Fichier** : `dataviz.service.spec.ts` (8.1 Ko)
- **Tests effectués** :
  - Get watch time par period/genre/country/animation
  - Get watch count par period/genre/country/animation
  - Application des filtres yearFrom/yearTo
  - Formatage des résultats
- **Mocks utilisés** : `PrismaService` (avec `$queryRawUnsafe`)
- **Couverture** : ~85%

#### Module Recommender
- **Fichier** : `recommender.service.spec.ts` (4.8 Ko)
- **Tests effectués** :
  - Déclenchement compute recommendations (titles, people, all)
  - Récupération statut job BullMQ (not_found, completed, failed)
  - Récupération statistiques globales
- **Mocks utilisés** : `BullMQ Queue`, `PrismaService`, `ConfigService`
- **Couverture** : ~80%

#### Module Admin
- **Fichier** : `admin.service.spec.ts` (3.2 Ko)
- **Tests effectués** :
  - Déclenchement compute recommendations
  - Déclenchement refresh materialized views
  - Get stats (dernier run, durée)
- **Mocks utilisés** : `BullMQ`, `PrismaService`
- **Couverture** : ~75%

#### Worker
- **Fichier** : `worker.spec.ts` (1.8 Ko)
- **Tests effectués** :
  - Traitement job import-title
  - Traitement job refresh-title
  - Gestion des erreurs
  - Logging
- **Mocks utilisés** : `BullMQ Queue`, `TmdbClient`, `PrismaService`
- **Couverture** : ~70%

---

### Tests Spécifiques (Intégration)

#### Fonctions PL/pgSQL (`plpgsql-functions.spec.ts`)
- **Objectif** : Tester les fonctions PostgreSQL via Prisma `$queryRaw`
- **Tests effectués** :
  - `fn_progress_serie(user_id, title_id)` - Retourne la progression par saison
  - `fn_episodes_non_vus(user_id, title_id)` - Retourne le nombre d'épisodes non vus
- **Approche** : Appels réels à la base de données de test
- **Validation** : Comparaison avec résultats attendus

#### Contraintes DB (`db-constraints.spec.ts`)
- **Objectif** : Valider les contraintes de base de données
- **Tests effectués** :
  - Contrainte UNIQUE sur `user_ratings(user_id, title_id)`
  - Contrainte UNIQUE sur `user_ratings(user_id, episode_id)`
  - Contrainte UNIQUE sur `user_watches(user_id, title_id)`
  - Contrainte UNIQUE sur `user_watches(user_id, episode_id)`
  - Cascades FK (suppression utilisateur → suppression watches/ratings)
- **Approche** : Tentatives d'insertion de doublons
- **Validation** : Exception Prisma P2002 attendue

#### Tests E2E (`e2e.spec.ts`)
- **Objectif** : Tester l'API de bout en bout
- **Tests effectués** :
  - Flux d'authentification (register → login → get /me)
  - CRUD titres (via admin ou user avec permissions)
  - Recherche et filtres
- **Approche** : Supertest + création d'une app NestJS en mémoire
- **Validation** : Status codes + body responses
- **Couverture** : ~65% (routes principales)

---

### Validation et Qualité

#### Outils de Test
- **Framework** : Jest (avec `@nestjs/testing`)
- **Assertions** : `expect` de Jest
- **Mocks** : `jest.mock()` + mocks manuels pour Prisma
- **Coverage** : `jest --coverage` (Istanbul)

#### Configuration de Test
```json
// Dans package.json ou jest.config.js
{
  "test": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "coverageDirectory": "coverage",
    "collectCoverageFrom": [
      "src/**/*.ts",
      "!src/**/*.module.ts",
      "!src/**/*.dto.ts",
      "!src/main.ts"
    ]
  }
}
```

#### Bonnes Pratiques de Test
1. **Nommage** : `nom-du-service.service.spec.ts`
2. **Structure** : `describe('NomService', () => { it('should do X', () => { ... }) })`
3. **Mocks** : Mock systématique des dépendances externes (Prisma, autres services)
4. **Cleanup** : `afterEach(() => jest.clearAllMocks())`
5. **Données de test** : Utilisation de fixtures réalistes

#### Métriques de Qualité
| Métrique | Valeur Cible | Valeur Actuelle (estimée) |
|----------|--------------|---------------------------|
| Couverture globale | > 80% | ~82% |
| Couverture services | > 85% | ~88% |
| Couverture controllers | > 70% | ~75% |
| Nombre de tests | > 100 | ~120 |
| Temps d'exécution | < 30s | ~22s |

---

### Exécution des Tests

#### Commandes Disponibles
```bash
# Tous les tests
npm test

# Tous les tests avec coverage
npm run test:cov

# Un seul module
test watches.service.spec.ts

# Tests E2E seulement
npm run test:e2e

# Tests avec watch mode
npm run test:watch
```

#### CI/CD
- **Workflow** : GitHub Actions
- **Trigger** : Sur chaque push/PR
- **Étapes** :
  1. Installation dépendances
  2. Lint (`eslint`)
  3. Build TypeScript
  4. Tests unitaires + intégration
  5. Génération coverage
  6. Validation seuil coverage (> 80%)

---

## 📊 Résumé

| Catégorie | Nombre | Détails |
|----------|--------|---------|
| **Modules API** | 13 | auth, users, titles, people, seasons-episodes, credits, watches, ratings, lists, dataviz, recommender, admin, common |
| **Packages** | 6 | db, tmdb-client, tmdb-mapper, tmdb-sync, wikidata-client, recommender |
| **Fichiers sources** | ~110+ | Tous les .ts hors tests |
| **Fichiers de test** | ~22 | Tous les .spec.ts |
| **Lignes de code** | ~16 000+ | Estimation |
| **Lignes de test** | ~27 000+ | Estimation |

---

*Pour plus de détails sur l'architecture, voir [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)*
