# Contexte — Phase 4.2 : Module ratings (notes & commentaires)

## Décisions stratégiques

| Question | Décision |
|----------|----------|
| 5. Upsert : PUT vs POST | **PUT /ratings** — body { title_id?, episode_id?, note_perso?, commentaire? }, comportement upsert |
| 6. GET /titles/:id/ratings public ou auth ? | **Public** — accessible sans JWT (page publique film) |
| 7. Suppression : hard vs soft delete | **Hard delete** — DELETE FROM user_ratings WHERE id = ... |

## Dépendances

### Externes
- `auth` → `JwtAuthGuard`, `@CurrentUser()` pour les endpoints d'écriture
- `titles` → validation d'existence des titres + récupération du type pour le filtre
- `Prisma` → `user_ratings` (déjà dans PrismaService)

### Schéma Prisma concerné
```prisma
model user_ratings {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id     String    @db.Uuid
  title_id    String?   @db.Uuid
  episode_id  String?   @db.Uuid
  note_perso  Decimal?  @db.Decimal(3, 1)
  commentaire String?
  created_at  DateTime  @default(now()) @db.Timestamptz(6)
  updated_at  DateTime  @default(now()) @db.Timestamptz(6)
  episodes    episodes? @relation(fields: [episode_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  titles      titles?   @relation(fields: [title_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  users       users     @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@unique([user_id, episode_id])
  @@unique([user_id, title_id])
  @@index([user_id], map: "idx_ratings_user")
}
```

## Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| `PUT` | `/ratings` | ✅ | `UpsertRatingDto` | Créer ou mettre à jour une note (upsert via contrainte UNIQUE) |
| `DELETE` | `/ratings/:id` | ✅ | — | Supprimer une note (vérifie appartenance) |
| `GET` | `/ratings` | ✅ | `ListRatingsFilterDto` | Liste des notes de l'utilisateur, paginée, filtrée par type |
| `GET` | `/titles/:id/ratings` | ❌ (public) | — | Résumé public des notes d'un titre (moyenne, répartition, count) |

## DTOs

```typescript
// UpsertRatingDto
class UpsertRatingDto {
  @IsOptional()
  @IsUUID()
  title_id?: string;

  @IsOptional()
  @IsUUID()
  episode_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  note_perso?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commentaire?: string;
}
// Validation: soit title_id, soit episode_id (pas les deux, pas aucun)
// Au moins un champ optionnel doit être présent
```

```typescript
// ListRatingsFilterDto (extends PaginationDto)
class ListRatingsFilterDto {
  @IsOptional()
  @IsEnum(['film', 'serie'])
  type?: 'film' | 'serie';

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

## Fonctions RatingsService

```typescript
class RatingsService {
  // Upsert : cherche existant par (user_id, title_id) ou (user_id, episode_id)
  // Si trouvé → UPDATE (note_perso, commentaire)
  // Si non trouvé → CREATE
  upsertRating(userId: string, dto: UpsertRatingDto): Promise<any>

  // Hard delete avec vérification d'appartenance
  deleteRating(id: string, userId: string): Promise<void>

  // Liste des notes de l'utilisateur, avec jointure titles pour le type
  listUserRatings(userId: string, filters: ListRatingsFilterDto): Promise<PaginatedRatings>

  // Résumé public : moyenne, count, répartition des notes (1-10)
  getTitleRatingsSummary(titleId: string): Promise<TitleRatingsSummary>
}
```

## Types de retour

```typescript
interface PaginatedRatings {
  data: Array<{
    id: string;
    note_perso: number | null;
    commentaire: string | null;
    created_at: Date;
    updated_at: Date;
    title?: { id: string; tmdb_id: number | null; titre_vo: string; titre_vf: string | null; affiche_url: string | null; type: string };
    episode?: { id: string; numero: number; titre: string | null; season?: { numero: number } };
  }>;
  total: number;
  page: number;
  limit: number;
}

interface TitleRatingsSummary {
  title_id: string;
  moyenne: number | null;
  count: number;
  repartition: Record<number, number>; // { 1: 0, 2: 3, ... 10: 1 }
}
```

## Structure prévue

```
apps/api/src/ratings/
├── ratings.module.ts
├── ratings.controller.ts
├── ratings.service.ts
├── dto/
│   ├── upsert-rating.dto.ts
│   └── list-ratings-filter.dto.ts
└── ratings.service.spec.ts
```

## Plan de tests

### upsertRating
- Crée un rating (title_id fourni, aucun existant)
- Met à jour un rating existant (même user_id + title_id)
- Crée un rating pour un épisode
- Met à jour note_perso seulement
- Met à jour commentaire seulement
- Lève BadRequest si ni title_id ni episode_id
- Lève BadRequest si les deux sont fournis

### deleteRating
- Supprime un rating existant
- Lève NotFound si le rating n'existe pas
- Lève Forbidden si le rating appartient à un autre user

### listUserRatings
- Retourne la liste paginée de l'utilisateur
- Filtre par type (film/serie)
- Vérifie la jointure titles.type pour le filtre

### getTitleRatingsSummary
- Retourne moyenne + count + répartition pour un titre existant
- Retourne moyenne=null, count=0 si aucune note
- Lève NotFound si le titre n'existe pas

