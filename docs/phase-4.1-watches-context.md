# Contexte — Phase 4.1 : Module watches (visionnage + suivi + calendrier)

## Décisions stratégiques

| Question | Décision |
|----------|----------|
| 1. Module unique watches + follows | **Oui** — un seul module `watches` (4.1) intègre `user_watches`, `user_follows_serie` et le calendrier |
| 2. Découpage fichiers | **Controller + Service** (tout dans `watches.service.ts`, y compris follows et calendrier) |
| 3. Calendrier — types PL/pgSQL | **Déjà prêts** — `countEpisodesNonVus()` et `getSerieProgress()` existent dans `packages/db/src/functions.ts` avec leurs types |
| 4. Re-watch | **OK** — pas de contrainte UNIQUE sur user_watches, un utilisateur peut marquer le même titre/épisode vu plusieurs fois |

## Dépendances

### Externes
- `packages/db` → `countEpisodesNonVus`, `getSerieProgress` (dans `@emdb/db`)
- `auth` → `JwtAuthGuard`, `@CurrentUser()` pour tous les endpoints
- `titles` → validation d'existence des titres (vérifier que le title_id existe)
- (aucune dépendance vers seasons-episodes, la jointure se fait via Prisma)

### Schéma Prisma
- `user_watches` — table principale
- `user_follows_serie` — suivi des séries
- `titles` — jointure pour les infos de titre
- `episodes` — jointure optionnelle si episode_id fourni
- `notifications` — (optionnel, Phase 7)

## Endpoints

### Watches

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| `POST` | `/watches` | ✅ | `CreateWatchDto` | Marquer vu (titre ou épisode) |
| `DELETE` | `/watches/:id` | ✅ | — | Supprimer un watch |
| `GET` | `/watches` | ✅ | `ListWatchesFilterDto` | Liste des visionnages (paginé, filtré) |
| `GET` | `/titles/:titleId/progress` | ✅ | — | Progression série (fn_progress_serie) |
| `GET` | `/calendar` | ✅ | — | Calendrier épisodes non vus |

### Follows

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| `POST` | `/follows` | ✅ | `FollowSerieDto` | Suivre une série |
| `DELETE` | `/follows/:titleId` | ✅ | — | Ne plus suivre |
| `GET` | `/follows` | ✅ | — | Liste des séries suivies |

## DTOs

```typescript
// CreateWatchDto
class CreateWatchDto {
  @IsOptional()
  @IsUUID()
  title_id?: string;  // UUID du titre (film ou série)

  @IsOptional()
  @IsUUID()
  episode_id?: string;  // UUID de l'épisode

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date_vue?: Date;  // Date du visionnage (défaut: aujourd'hui)
}
// Validation: soit title_id, soit episode_id (pas les deux, pas aucun)
```

```typescript
// ListWatchesFilterDto (extends PaginationDto)
class ListWatchesFilterDto {
  @IsOptional()
  @IsEnum(['film', 'serie'])
  type?: 'film' | 'serie';

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date_from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date_to?: Date;

  @IsOptional()
  @IsUUID()
  title_id?: string;

  // Pagination
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

```typescript
// FollowSerieDto
class FollowSerieDto {
  @IsUUID()
  @IsNotEmpty()
  title_id!: string;
}
```

## Fonctions WatchesService

```typescript
class WatchesService {
  // Watches
  createWatch(userId: string, dto: CreateWatchDto): Promise<any>
  deleteWatch(id: string, userId: string): Promise<void>
  listWatches(userId: string, filters: ListWatchesFilterDto): Promise<PaginatedWatches>

  // Progression (PL/pgSQL)
  getSerieProgress(userId: string, titleId: string): Promise<ProgressSerieResult[]>
  getCalendar(userId: string): Promise<CalendarEntry[]>

  // Follows
  follow(userId: string, titleId: string): Promise<any>
  unfollow(userId: string, titleId: string): Promise<void>
  getFollowedSeries(userId: string): Promise<any[]>
}
```

## Types de retour

```typescript
interface PaginatedWatches {
  data: Array<{
    id: string;
    date_vue: Date;
    created_at: Date;
    title?: { id: string; tmdb_id: number | null; titre_vo: string; titre_vf: string | null; affiche_url: string | null; type: string };
    episode?: { id: string; numero: number; titre: string | null; season?: { numero: number } };
  }>;
  total: number;
  page: number;
  limit: number;
}

interface CalendarEntry {
  title_id: string;
  titre_vo: string;
  titre_vf: string | null;
  affiche_url: string | null;
  saison: number;
  episode_numero: number;
  episode_titre: string | null;
  date_diffusion: Date | null;
  nb_non_vus: number;
}
```

## Structure prévue

```
apps/api/src/watches/
├── watches.module.ts
├── watches.controller.ts
├── watches.service.ts
├── dto/
│   ├── create-watch.dto.ts
│   ├── list-watches-filter.dto.ts
│   └── follow-serie.dto.ts
└── watches.service.spec.ts
```

## Structure des tests

### createWatch
- Crée un watch pour un title_id
- Crée un watch pour un episode_id
- Lève BadRequest si ni title_id ni episode_id
- Lève BadRequest si les deux sont fournis
- Gère la date personnalisée
- Utilise la date du jour par défaut

### deleteWatch
- Supprime un watch existant
- Lève NotFound si le watch n'existe pas
- Lève Forbidden si le watch appartient à un autre user

### listWatches
- Retourne la liste paginée
- Filtre par type
- Filtre par date

### getSerieProgress
- Appelle getSerieProgress depuis @emdb/db
- Lève NotFound si le titre n'existe pas
- Lève BadRequest si le titre n'est pas une série

### getCalendar
- Appelle countEpisodesNonVus pour chaque série suivie
- Retourne un tableau vide si aucune série non suivie
- Tri par nb_non_vus décroissant

### follow / unfollow / getFollowedSeries
- follow crée une entrée dans user_follows_serie
- follow lève BadRequest si le titre n'est pas une série (vérification applicative)
- unfollow supprime l'entrée
- getFollowedSeries liste les séries suivies

