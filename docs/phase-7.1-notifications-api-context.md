# Contexte — Phase 7.1 : Module API notifications

## Décisions stratégiques

| Question | Décision | Justification |
|----------|----------|---------------|
| 1. Module NestJS dédié | **(a) Module `notifications` séparé** | Cohérent avec la structure existante (1 module = 1 fonctionnalité). La table `notifications` est déjà modélisée dans Prisma et exposée dans `PrismaService`. |
| 2. Endpoints | **(a) 4 endpoints REST** | `GET /notifications` (liste), `PATCH /notifications/:id/read` (marquer lu), `PATCH /notifications/read-all` (tout marquer), `GET /notifications/unread-count` (compteur). Couvre les besoins sans sur-ingénierie. |
| 3. Pagination | **(a) Oui, pagination standard** | Cohérent avec les autres modules (watches, ratings, lists). DTO `ListNotificationsFilterDto` avec `page` et `limit`. |
| 4. Tri | **(a) Non lues en priorité** | Les notifications non lues sont plus importantes pour l'utilisateur. Tri : `lu ASC, created_at DESC`. |
| 5. Marquage "read-all" | **(a) PATCH /notifications/read-all** | Un seul appel pour tout marquer, évite N appels. Retourne le nombre de notifications marquées. |

## Dépendances

### Externes
- `@emdb/db` → Prisma : table `notifications` (déjà dans PrismaService)
- `auth` → `JwtAuthGuard`, `@CurrentUser()` pour tous les endpoints
- `episodes` → jointure optionnelle pour les infos d'épisode

### Schéma Prisma concerné
```prisma
model notifications {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id    String    @db.Uuid
  episode_id String?   @db.Uuid
  type       String
  lu         Boolean   @default(false)
  created_at DateTime  @default(now()) @db.Timestamptz(6)
  episodes   episodes? @relation(fields: [episode_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  users      users     @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
}
```

Le delegate `prisma.notifications` est déjà exposé dans `PrismaService`.

### Table des index existants
- `notifications_pkey` — PRIMARY KEY (id)
- Pas d'index explicite sur `(user_id, lu, created_at)` dans Prisma
- À ajouter si la table devient volumineuse (recommandé : index composite)

## Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| `GET` | `/notifications` | ✅ JWT | `ListNotificationsFilterDto` | Liste paginée des notifications (non lues en priorité) |
| `PATCH` | `/notifications/:id/read` | ✅ JWT | — | Marquer une notification comme lue |
| `PATCH` | `/notifications/read-all` | ✅ JWT | — | Marquer toutes les notifications comme lues |
| `GET` | `/notifications/unread-count` | ✅ JWT | — | Compteur de notifications non lues |

### Détail des endpoints

#### 1. `GET /notifications`
- Paramètres : `page`, `limit` (optionnels, défauts : page=1, limit=20)
- Retourne :
  ```typescript
  {
    data: Array<{
      id: string;
      type: string;         // 'new_episode' | 'season_premiere' | 'series_return'
      lu: boolean;
      created_at: Date;
      episode?: {
        id: string;
        numero: number;
        titre: string | null;
        season?: { numero: number };
        titles?: { id: string; titre_vo: string; affiche_url: string | null };
      };
    }>;
    total: number;
    page: number;
    limit: number;
  }
  ```
- Tri : `lu ASC, created_at DESC` (non lues d'abord, puis plus récentes en premier)

#### 2. `PATCH /notifications/:id/read`
- Paramètre : `id` (UUID de la notification)
- Comportement : SET `lu = true`
- Contrôle : NotFoundException si la notification n'existe pas ou n'appartient pas à l'utilisateur
- Retour : `{ success: true }`

#### 3. `PATCH /notifications/read-all`
- Comportement : UPDATE notifications SET `lu = true` WHERE `user_id = userId` AND `lu = false`
- Retour : `{ success: true, marked_count: number }`

#### 4. `GET /notifications/unread-count`
- Retourne : `{ count: number }`

## DTOs

```typescript
// ListNotificationsFilterDto
class ListNotificationsFilterDto {
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

## Fonctions NotificationsService

```typescript
class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Liste paginée, triée par non lues en priorité + date décroissante
  listNotifications(userId: string, filters: ListNotificationsFilterDto): Promise<PaginatedNotifications>

  // Marque une notification spécifique comme lue
  markAsRead(notificationId: string, userId: string): Promise<void>

  // Marque toutes les notifications de l'utilisateur comme lues
  markAllAsRead(userId: string): Promise<{ marked_count: number }>

  // Compteur de notifications non lues
  getUnreadCount(userId: string): Promise<{ count: number }>
}
```

### Logique du service

```typescript
async listNotifications(userId: string, filters: ListNotificationsFilterDto) {
  const where = { user_id: userId };
  const [data, total] = await Promise.all([
    this.prisma.notifications.findMany({
      where,
      include: {
        episodes: {
          select: {
            id: true,
            numero: true,
            titre: true,
            season: {
              select: { numero: true },
            },
          },
        },
      },
      orderBy: [
        { lu: 'asc' },
        { created_at: 'desc' },
      ],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    this.prisma.notifications.count({ where }),
  ]);

  return {
    data: data.map((n) => ({
      id: n.id,
      type: n.type,
      lu: n.lu,
      created_at: n.created_at,
      episode: n.episodes,
    })),
    total,
    page: filters.page,
    limit: filters.limit,
  };
}

async markAsRead(notificationId: string, userId: string): Promise<void> {
  const notification = await this.prisma.notifications.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new NotFoundException('Notification introuvable.');
  }

  if (notification.user_id !== userId) {
    throw new ForbiddenException('Cette notification ne vous appartient pas.');
  }

  await this.prisma.notifications.update({
    where: { id: notificationId },
    data: { lu: true },
  });
}

async markAllAsRead(userId: string): Promise<{ marked_count: number }> {
  const result = await this.prisma.notifications.updateMany({
    where: { user_id: userId, lu: false },
    data: { lu: true },
  });

  return { marked_count: result.count };
}

async getUnreadCount(userId: string): Promise<{ count: number }> {
  const count = await this.prisma.notifications.count({
    where: { user_id: userId, lu: false },
  });

  return { count };
}
```

## Structure prévue

```
apps/api/src/notifications/
├── notifications.module.ts
├── notifications.controller.ts
├── notifications.service.ts
├── dto/
│   └── list-notifications-filter.dto.ts
└── notifications.service.spec.ts
```

## Plan de tests

### listNotifications
- Retourne la liste paginée, triée par non lues en priorité + created_at DESC
- Retourne un tableau vide si aucune notification
- Applique correctement la pagination (skip/take)

### markAsRead
- Marque une notification comme lue
- Lève NotFoundException si la notification n'existe pas
- Lève ForbiddenException si la notification appartient à un autre user

### markAllAsRead
- Marque toutes les notifications de l'utilisateur comme lues
- Retourne le nombre de notifications marquées
- Ne marque pas les notifications déjà lues

### getUnreadCount
- Retourne le nombre de notifications non lues
- Retourne 0 si toutes les notifications sont lues

## Critères d'acceptation

1. [ ] Un utilisateur peut consulter ses notifications (GET /notifications)
2. [ ] Les notifications non lues apparaissent en premier
3. [ ] Un utilisateur peut marquer une notification comme lue
4. [ ] Un utilisateur peut marquer toutes ses notifications comme lues
5. [ ] Un utilisateur peut voir son nombre de notifications non lues
6. [ ] Un utilisateur ne peut pas marquer la notification d'un autre utilisateur
7. [ ] La pagination fonctionne (page + limit)
8. [ ] Tous les endpoints retournent 401 si non authentifié
9. [ ] Tous les tests unitaires passent

## Documentation

- [ ] Mettre à jour ARCHITECTURE_OVERVIEW.md (Module 13: Notifications)
- [ ] Mettre à jour TECHNICAL_DETAILS.md (structure + tests)
- [ ] Mettre à jour emdb_roadmap_backend.md (Phase 7.1 cochée)
- [ ] Documenter le module dans docs/README.md