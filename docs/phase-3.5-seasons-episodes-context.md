# Contexte — Phase 3.5 : Module seasons-episodes

## État actuel

### Déjà implémenté dans les phases précédentes

**Prisma (schema et relations)**
- `seasons` : table liée à `titles` via `title_id`, contient `numero`, `titre`, `date_sortie`, `synopsis`
- `episodes` : table liée à `seasons` via `season_id`, contient `numero`, `titre`, `synopsis`, `date_sortie`, `duree_minutes`, `image_url`
- `credits.episode_id` : permet de lier des crédits à un épisode spécifique (guest stars, crew épisode)
- Relations disponibles depuis PrismaService : `seasons`, `episodes`, `credits`, `titles`, `roles`

**TMDB Client** (packages/tmdb-client)
- `getTvSeason(tmdbId, seasonNumber)` — récupère une saison complète avec ses épisodes ✅
- `getTvEpisodeDetails(tmdbId, season, episode, append_to_response='credits')` — récupère les crédits d'un épisode ✅

**TMDB Mapper** (packages/tmdb-mapper)
- `mapTmdbSeason(tmdbSeason, titleId)` — mappe une saison TMDB → format d'insertion ✅
- `mapTmdbEpisode(tmdbEpisode, seasonId)` — mappe un épisode TMDB → format d'insertion ✅
- `mapTmdbEpisodeCredits(tmdbEpisodeCredits, episodeId)` — mappe les crédits d'épisode (guest stars + crew) ✅
- `mapTmdbCredits(tmdbCredits, titleId, episodeId)` — mappe les crédits génériques d'un titre ✅

**TMDB Sync** (packages/tmdb-sync)
- `importSeasonsForSerie(titleId)` — importe toutes les saisons/épisodes d'une série ✅
- `importEpisodeGuestCredits(episodeId, tmdbId, season, episode)` — importe les guest stars d'un épisode ✅

**Module Titles** (déjà implémenté)
- `GET /titles/:id` — retourne le détail complet incluant les saisons et épisodes via `include: { seasons: { include: { episodes } } }`
- `GET /titles/:id/seasons` — délégué à `SeasonsEpisodesService` (pas encore implémenté)

### Modules NestJS déjà existants (pattern à suivre)
- `auth` — JWT, guards, stratégies
- `users` — 5 endpoints, 10 tests
- `titles` — 7 endpoints, 14 tests
- `people` — 6 endpoints, 17 tests

Chaque module suit : `module.ts` + `controller.ts` + `service.ts` + `dto/*.ts` + `*.spec.ts`

---

## Endpoints à implémenter (Phase 3.5)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/titles/:titleId/seasons` | Public | Liste des saisons d'un titre (triées par numero) |
| `GET` | `/titles/:titleId/seasons/:numero` | Public | Détail saison + liste des épisodes (triés par numero) |
| `GET` | `/episodes/:id` | Public | Détail épisode (synopsis, date_sortie, image_url, durée) |
| `GET` | `/episodes/:id/credits` | Public | Guest stars/crew spécifiques à l'épisode (credits.episode_id) |

### Détail des endpoints

#### 1. `GET /titles/:titleId/seasons`
- Paramètres : `titleId` (UUID)
- Retourne : `[{ id, numero, titre, date_sortie, synopsis, nombre_episodes }]`
- Tri : par `numero` asc
- Contrôle : NotFoundException si le titre n'existe pas

#### 2. `GET /titles/:titleId/seasons/:numero`
- Paramètres : `titleId` (UUID), `numero` (integer)
- Retourne : `{ id, numero, titre, date_sortie, synopsis, episodes: [...] }`
- Les épisodes inclus : `id, numero, titre, synopsis, date_sortie, duree_minutes, image_url`
- Tri des épisodes : par `numero` asc
- Contrôle : NotFoundException si le titre ou la saison n'existe pas

#### 3. `GET /episodes/:id`
- Paramètres : `id` (UUID)
- Retourne : `{ id, numero, titre, synopsis, date_sortie, duree_minutes, image_url, season_id, season: { numero, titre } }`
- Inclut les infos de la saison parente pour le contexte

#### 4. `GET /episodes/:id/credits`
- Paramètres : `id` (UUID)
- Retourne : crédits groupés par rôle (comme dans le module people/getFilmography)
- Lecture : `credits` filtrés par `episode_id`, avec jointure `people` et `roles`
- Contrôle : NotFoundException si l'épisode n'existe pas

---

## Fonctions du service

```typescript
SeasonsEpisodesService {
  listSeasons(titleId: string): Promise<Season[]>
  getSeason(titleId: string, numero: number): Promise<SeasonWithEpisodes>
  getEpisode(episodeId: string): Promise<EpisodeWithSeason>
  getEpisodeCredits(episodeId: string): Promise<GroupedCredits>
}
```

---

## Arborescence prévue

```
apps/api/src/seasons-episodes/
├── seasons-episodes.module.ts
├── seasons-episodes.controller.ts
├── seasons-episodes.service.ts
├── dto/
│   └── (aucun DTO nécessaire — paramètres simples UUID/int)
└── seasons-episodes.service.spec.ts
```

---

## Points ouverts / Questions stratégiques

### 1. Organisation du controller
Le chemin `/titles/:titleId/seasons` suggère que les endpoints saisons devraient être dans le controller `titles`, mais la roadmap prévoit un module dédié `seasons-episodes`. Deux approches :

- **(a)** Module indépendant `seasons-episodes` avec ses propres routes `GET /titles/:titleId/seasons` (utilise le path pattern mais contrôleur dédié)
- **(b)** Sous-controller rattaché à `TitlesController` (registration via `@Module` avec `TitlesController` existant)

**Recommandé : (a)** — plus modulaire, testable indépendamment, cohérent avec les modules `people` et `titles`.

### 2. Épisode/season progress endpoints
La roadmap mentionne : *"Les endpoints qui dépendent d'un utilisateur — fn_progress_serie (vue datée par saison) et fn_episodes_non_vus (calendrier) — sont logiquement de la Phase 4"*.

Ces endpoints ne sont **PAS** à implémenter ici. Ils seront dans un futur module `watches` (Phase 4).

### 3. Credits d'épisode vs credits de titre
`GET /episodes/:id/credits` doit retourner les credits **spécifiques** à l'épisode (ceux avec `episode_id` non null), pas les credits génériques du titre parent.

⚠️ **Attention** : actuellement `importSeasonsForSerie` n'appelle PAS `importEpisodeGuestCredits`. Les credits d'épisode ne seront peuplés que si un import dédié est déclenché. À documenter ou à prévoir dans un futur job de synchronisation.

### 4. Route `/episodes/:id` vs `/titles/:titleId/seasons/:numero/episodes/:episodeNumero`
La roadmap choisit `/episodes/:id` (par UUID) plutôt qu'une route imbriquée complète. C'est plus simple pour le frontend qui peut stocker l'UUID directement.

