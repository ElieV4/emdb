# Contexte — Phase 6.1 : Module API Dataviz

## Décisions stratégiques (tranchées)

| Question | Décision | Justification |
|----------|----------|---------------|
| 1. Découpage | **6.1 API + 6.2 Refresh** | 6.1 = endpoints NestJS + tests ; 6.2 = POST /admin/refresh + BullMQ cron |
| 2. Structure API | **2 endpoints avec param `groupBy`** | `GET /dataviz/watch-time?groupBy=genre\|period\|country\|animation` et idem pour `watch-count`. Moins de routes, plus RESTful. |
| 3. Filtres période | **(b) `yearFrom`/`yearTo` optionnels** | L'utilisateur peut filtrer ses stats par année pour explorer ses données. |
| 4. Auth | **(a) JWT requis** | Données personnelles de visionnage. |
| 5. Refresh endpoint | **(a) Oui dans 6.2** | `POST /admin/refresh-materialized-views` + BullMQ. |

## Dépendances

### Externes
- `@emdb/db` → les 8 wrappers existants dans `packages/db/src/functions.ts` :
  - `getWatchTimeByPeriod`, `getWatchTimeByGenre`, `getWatchTimeByCountry`, `getWatchTimeByAnimation`
  - `getWatchCountByGenre`, `getWatchCountByPeriod`, `getWatchCountByCountry`, `getWatchCountByAnimation`
- `auth` → `JwtAuthGuard`, `@CurrentUser()`
- `PrismaService` — déjà dans `@emdb/db` via `prisma`

### Schéma concerné (vues matérialisées — hors Prisma, en SQL pur)
```sql
-- Vues watch_time
mv_watch_time_by_period   (user_id, periode_semaine, periode_mois, periode_annee, minutes)
mv_watch_time_by_genre    (user_id, genre_id, minutes)
mv_watch_time_by_country  (user_id, country_id, minutes)
mv_watch_time_by_animation(user_id, is_animation, minutes)

-- Vues watch_count
mv_watch_count_by_genre    (user_id, genre_id, nb_items)
mv_watch_count_by_period   (user_id, periode_semaine, periode_mois, periode_annee, nb_items)
mv_watch_count_by_country  (user_id, country_id, nb_items)
mv_watch_count_by_animation(user_id, is_animation, nb_items)
```

## Endpoints

| Method | Path | Auth | Query params | Description |
|--------|------|------|-------------|-------------|
| `GET` | `/dataviz/watch-time` | ✅ JWT | `groupBy` (required), `yearFrom?`, `yearTo?` | Temps total de visionnage groupé par critère |
| `GET` | `/dataviz/watch-count` | ✅ JWT | `groupBy` (required), `yearFrom?`, `yearTo?` | Nombre de visionnages groupé par critère |

### DTOs

```typescript
// WatchTimeQueryDto
class WatchTimeQueryDto {
  @IsEnum(['genre', 'period', 'country', 'animation'])
  groupBy!: 'genre' | 'period' | 'country' | 'animation';

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  @Transform(({ value }) => parseInt(value, 10))
  yearFrom?: number;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  @Transform(({ value }) => parseInt(value, 10))
  yearTo?: number;
}

// WatchCountQueryDto (même structure)
class WatchCountQueryDto {
  @IsEnum(['genre', 'period', 'country', 'animation'])
  groupBy!: 'genre' | 'period' | 'country' | 'animation';

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  @Transform(({ value }) => parseInt(value, 10))
  yearFrom?: number;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  @Transform(({ value }) => parseInt(value, 10))
  yearTo?: number;
}
```

## Fonctions DatavizService

```typescript
@Injectable()
export class DatavizService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le temps de visionnage groupé par le critère demandé.
   * Supporte le filtrage optionnel par année (yearFrom/yearTo).
   * 
   * Pour les vues 'period', le filtre année s'applique sur periode_annee.
   * Pour les autres vues, le filtre nécessite une jointure avec user_watches
   * pour filtrer par date_vue (les vues matérialisées n'ont pas de colonne date).
   *
   * Stratégie pour le filtrage année sur genre/country/animation :
   * On ne peut pas filtrer directement les MV qui n'ont pas de colonne date.
   * Option 1 : Ajouter une condition WHERE dans $queryRaw avec une sous-requête
   * Option 2 : Filtrer côté application après récupération
   * 
   * → Option 1 : On appelle via $queryRaw avec un filtre supplémentaire sur
   *   user_watches.date_vue si yearFrom/yearTo sont fournis.
   *   Mais les MV n'ont pas cette colonne → on ne peut pas filtrer les MV 
   *   existantes par année pour genre/country/animation sans les recréer.
   * 
   * → Solution pragmatique :
   *   - Pour 'period' : WHERE EXTRACT(YEAR FROM periode_semaine) BETWEEN yearFrom AND yearTo
   *   - Pour 'genre', 'country', 'animation' : si yearFrom/yearTo sont fournis,
   *     on fait un REFRESH MATERIALIZED VIEW (bloquant, rapide car les données
   *     sont en cache) MAIS ce n'est pas idéal.
   *   - SOLUTION FINALE : On ignore le filtre année pour genre/country/animation
   *     sur les MV, mais on documente que le filtre s'applique aux vues period.
   *     Si l'utilisateur veut filtrer par année sur les stats, il utilise period.
   */
  async getWatchTime(userId: string, query: WatchTimeQueryDto): Promise<any[]> {
    switch (query.groupBy) {
      case 'period': {
        let sql = `SELECT * FROM mv_watch_time_by_period WHERE user_id='${userId}'::UUID`;
        if (query.yearFrom !== undefined || query.yearTo !== undefined) {
          const yearFrom = query.yearFrom ?? 1900;
          const yearTo = query.yearTo ?? 2100;
          sql += ` AND EXTRACT(YEAR FROM periode_semaine) BETWEEN ${yearFrom} AND ${yearTo}`;
        }
        sql += ` ORDER BY periode_semaine`;
        const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
        return results || [];
      }
      case 'genre': {
        let sql = `SELECT * FROM mv_watch_time_by_genre WHERE user_id='${userId}'::UUID`;
        if (query.yearFrom !== undefined || query.yearTo !== undefined) {
          const yearFrom = query.yearFrom ?? 1900;
          const yearTo = query.yearTo ?? 2100;
          // On ne peut pas filtrer directement la MV → sous-requête sur user_watches
          sql = `
            SELECT wtg.* FROM mv_watch_time_by_genre wtg
            WHERE wtg.user_id='${userId}'::UUID
            AND EXISTS (
              SELECT 1 FROM user_watches uw
              JOIN titles t ON t.id = uw.title_id
              JOIN title_genres tg ON tg.title_id = t.id
              WHERE uw.user_id='${userId}'::UUID
              AND tg.genre_id = wtg.genre_id
              AND EXTRACT(YEAR FROM uw.date_vue) BETWEEN ${yearFrom} AND ${yearTo}
            )
          `;
        }
        sql += ` ORDER BY genre_id`;
        const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
        return results || [];
      }
      case 'country': {
        let sql = `SELECT * FROM mv_watch_time_by_country WHERE user_id='${userId}'::UUID`;
        if (query.yearFrom !== undefined || query.yearTo !== undefined) {
          const yearFrom = query.yearFrom ?? 1900;
          const yearTo = query.yearTo ?? 2100;
          sql = `
            SELECT wtc.* FROM mv_watch_time_by_country wtc
            WHERE wtc.user_id='${userId}'::UUID
            AND EXISTS (
              SELECT 1 FROM user_watches uw
              JOIN titles t ON t.id = uw.title_id
              JOIN title_countries tc ON tc.title_id = t.id
              WHERE uw.user_id='${userId}'::UUID
              AND tc.country_id = wtc.country_id
              AND EXTRACT(YEAR FROM uw.date_vue) BETWEEN ${yearFrom} AND ${yearTo}
            )
          `;
        }
        sql += ` ORDER BY country_id`;
        const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
        return results || [];
      }
      case 'animation': {
        let sql = `SELECT * FROM mv_watch_time_by_animation WHERE user_id='${userId}'::UUID`;
        if (query.yearFrom !== undefined || query.yearTo !== undefined) {
          const yearFrom = query.yearFrom ?? 1900;
          const yearTo = query.yearTo ?? 2100;
          sql = `
            SELECT wta.* FROM mv_watch_time_by_animation wta
            WHERE wta.user_id='${userId}'::UUID
            AND EXISTS (
              SELECT 1 FROM user_watches uw
              JOIN titles t ON t.id = uw.title_id
              WHERE uw.user_id='${userId}'::UUID
              AND t.is_animation = wta.is_animation
              AND EXTRACT(YEAR FROM uw.date_vue) BETWEEN ${yearFrom} AND ${yearTo}
            )
          `;
        }
        sql += ` ORDER BY is_animation`;
        const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
        return results || [];
      }
      default:
        return [];
    }
  }

  /**
   * Récupère le nombre de visionnages groupé par le critère demandé.
   * Même logique de filtre année que getWatchTime.
   */
  async getWatchCount(userId: string, query: WatchCountQueryDto): Promise<any[]> {
    switch (query.groupBy) {
      case 'period': {
        let sql = `SELECT * FROM mv_watch_count_by_period WHERE user_id='${userId}'::UUID`;
        if (query.yearFrom !== undefined || query.yearTo !== undefined) {
          const yearFrom = query.yearFrom ?? 1900;
          const yearTo = query.yearTo ?? 2100;
          sql += ` AND EXTRACT(YEAR FROM periode_semaine) BETWEEN ${yearFrom} AND ${yearTo}`;
        }
        sql += ` ORDER BY periode_semaine`;
        const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
        return results || [];
      }
      case 'genre': {
        let sql = `SELECT * FROM mv_watch_count_by_genre WHERE user_id='${userId}'::UUID`;
        if (query.yearFrom !== undefined || query.yearTo !== undefined) {
          const yearFrom = query.yearFrom ?? 1900;
          const yearTo = query.yearTo ?? 2100;
          sql = `
            SELECT wcg.* FROM mv_watch_count_by_genre wcg
            WHERE wcg.user_id='${userId}'::UUID
            AND EXISTS (
              SELECT 1 FROM user_watches uw
              JOIN titles t ON t.id = uw.title_id
              JOIN title_genres tg ON tg.title_id = t.id
              WHERE uw.user_id='${userId}'::UUID
              AND tg.genre_id = wcg.genre_id
              AND EXTRACT(YEAR FROM uw.date_vue) BETWEEN ${yearFrom} AND ${yearTo}
            )
          `;
        }
        sql += ` ORDER BY genre_id`;
        const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
        return results || [];
      }
      case 'country': {
        let sql = `SELECT * FROM mv_watch_count_by_country WHERE user_id='${userId}'::UUID`;
        if (query.yearFrom !== undefined || query.yearTo !== undefined) {
          const yearFrom = query.yearFrom ?? 1900;
          const yearTo = query.yearTo ?? 2100;
          sql = `
            SELECT wcc.* FROM mv_watch_count_by_country wcc
            WHERE wcc.user_id='${userId}'::UUID
            AND EXISTS (
              SELECT 1 FROM user_watches uw
              JOIN titles t ON t.id = uw.title_id
              JOIN title_countries tc ON tc.title_id = t.id
              WHERE uw.user_id='${userId}'::UUID
              AND tc.country_id = wcc.country_id
              AND EXTRACT(YEAR FROM uw.date_vue) BETWEEN ${yearFrom} AND ${yearTo}
            )
          `;
        }
        sql += ` ORDER BY country_id`;
        const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
        return results || [];
      }
      case 'animation': {
        let sql = `SELECT * FROM mv_watch_count_by_animation WHERE user_id='${userId}'::UUID`;
        if (query.yearFrom !== undefined || query.yearTo !== undefined) {
          const yearFrom = query.yearFrom ?? 1900;
          const yearTo = query.yearTo ?? 2100;
          sql = `
            SELECT wca.* FROM mv_watch_count_by_animation wca
            WHERE wca.user_id='${userId}'::UUID
            AND EXISTS (
              SELECT 1 FROM user_watches uw
              JOIN titles t ON t.id = uw.title_id
              WHERE uw.user_id='${userId}'::UUID
              AND t.is_animation = wca.is_animation
              AND EXTRACT(YEAR FROM uw.date_vue) BETWEEN ${yearFrom} AND ${yearTo}
            )
          `;
        }
        sql += ` ORDER BY is_animation`;
        const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
        return results || [];
      }
      default:
        return [];
    }
  }
}
```

## Structure prévue

```
apps/api/src/dataviz/
├── dataviz.module.ts
├── dataviz.controller.ts
├── dataviz.service.ts
├── dto/
│   ├── watch-time-query.dto.ts
│   └── watch-count-query.dto.ts
└── dataviz.service.spec.ts
```

## Plan de tests

### dataviz.service.ts
- `getWatchTime(period)` : retourne les données de mv_watch_time_by_period filtrées par user_id, triées
- `getWatchTime(period, yearFrom=2024, yearTo=2025)` : ajoute le filtre EXTRACT(YEAR)
- `getWatchTime(genre)` : retourne mv_watch_time_by_genre
- `getWatchTime(genre, yearFrom, yearTo)` : sous-requête EXISTS
- `getWatchTime(country)` : retourne mv_watch_time_by_country
- `getWatchTime(animation)` : retourne mv_watch_time_by_animation
- `getWatchCount(period)` : idem pour les vues count
- `getWatchCount(genre, yearFrom, yearTo)` : avec filtre EXISTS

### dataviz.controller.ts
- `GET /dataviz/watch-time?groupBy=genre` → 200 + data
- `GET /dataviz/watch-time?groupBy=invalid` → 400 (validation error)
- `GET /dataviz/watch-time?groupBy=period&yearFrom=2020` → 200 + data filtrée
- `GET /dataviz/watch-count?groupBy=country` → 200 + data
- `GET /dataviz/watch-count` sans groupBy → 400
- Les endpoints retournent 401 si non authentifié

