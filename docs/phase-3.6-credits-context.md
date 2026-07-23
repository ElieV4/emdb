# Contexte — Phase 3.6 : Module credits

## État actuel

### Déjà implémenté

**Dans Phase 3.4 (PeopleService)**
- `GET /people/:id/filmography` — jointure credits → titles, groupée par rôle, triée par date_sortie ✅

**Dans Phase 3.5 (SeasonsEpisodesService)**
- `GET /episodes/:id/credits` — credits spécifiques épisode (guest stars + crew), groupés par rôle ✅

### Ce qu'il reste de la Phase 3.6

```
3.6 Module credits
 GET /titles/:titleId/credits      — groupé cast/crew par rôle (via table roles)
 GET /episodes/:episodeId/credits  — déjà fait dans Phase 3.5
 GET /people/:personId/credits     — alias de getFilmography (déjà dans Phase 3.4)
```

---

## Endpoints à implémenter

La roadmap liste 3 endpoints mais **2 sont déjà couverts** :

| Method | Path | Statut | Notes |
|--------|------|--------|-------|
| `GET` | `/titles/:titleId/credits` | **À faire** | Cast/crew groupés par rôle (Nouveau) |
| `GET` | `/episodes/:episodeId/credits` | ✅ Fait (Phase 3.5) | Route `GET /episodes/:id/credits` |
| `GET` | `/people/:personId/credits` | ✅ Fait (Phase 3.4) | Route `GET /people/:id/filmography` |

### Endpoint à implémenter : `GET /titles/:titleId/credits`

- Paramètre : `titleId` (UUID)
- Retourne les credits du titre **sans episode_id** (crédits génériques du titre)
- Cast (role='acteur') trié par `ordre` asc
- Crew (réalisateur, scénariste, autre) groupé par rôle
- Jointure avec `people` (nom, photo, tmdb_id) et `roles` (libelle)
- Contrôle : NotFoundException si le titre n'existe pas

---

## Questions stratégiques

### 1. Faut-il un module credits dédié ou déléguer à TitlesService ?

**Contexte :** L'unique endpoint vraiment nouveau est `/titles/:titleId/credits`. Les deux autres endpoints de la roadmap existent déjà dans PeopleService et SeasonsEpisodesService.

- **(a)** Créer un module `credits` complet avec service dédié, controller déléguant aux services existants
- **(b)** Créer juste un controller `credits` (sans service propre) qui injecte `TitlesService` + réutilise les services existants
- **(c)** Ajouter directement la route dans `TitlesController` (pas de module dédié)

### 2. Duplication : `GET /people/:personId/credits` vs `GET /people/:id/filmography`

La roadmap liste `/people/:personId/credits` comme endpoint de CreditsService, mais `GET /people/:id/filmography` existe déjà et retourne la même chose. Faut-il :
- **(a)** Créer une route d'alias `/people/:id/credits` dans le controller people qui appelle `getFilmography` ? (le plus simple)
- **(b)** Ignorer ce point (le frontend utilise `/people/:id/filmography`)
- **(c)** Déplacer `getFilmography` de PeopleService vers CreditsService

### 3. Episode credits : dédoublonnage avec Phase 3.5

`GET /episodes/:episodeId/credits` est déjà implémenté dans SeasonsEpisodesService (route `/episodes/:id/credits`). 
- **(a)** Créer une route `/credits/episodes/:episodeId` qui redirige vers SeasonsEpisodesService
- **(b)** Ne rien faire, le frontend utilise `/episodes/:id/credits`

### Recommandation

Je recommande **1b + 2a + 3b** :
- Un vrai module NestJS `credits` pour suivre la convention
- Un `CreditsController` avec `GET /titles/:titleId/credits` uniquement (les deux autres sont déjà disponibles)
- `CreditsService.getTitleCredits()` dans le nouveau service
- Les routes existantes restent inchangées, le frontend continue d'utiliser `/people/:id/filmography` et `/episodes/:id/credits`

---

## Structure prévue

```
apps/api/src/credits/
├── credits.module.ts
├── credits.controller.ts    (1 endpoint : GET /titles/:titleId/credits)
├── credits.service.ts       (1 méthode : getTitleCredits)
└── credits.service.spec.ts
```

Pas de DTO nécessaire (param UUID simple).

