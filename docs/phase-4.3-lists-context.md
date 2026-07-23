# Contexte — Phase 4.3 : Module lists (listes, items, partage)

## Décisions stratégiques

| Question | Décision |
|----------|----------|
| 8. Permissions de partage | **Lecture + édition** — permission='lecture' ou 'edition', vérification applicative dans chaque endpoint |
| 9. Type de liste | **Énuméré** — `@IsEnum(['watchlist', 'favoris', 'custom'])` côté API ; le type `custom` permet un nom libre |
| 10. Doublons dans une liste | **Impossible** — contrainte `@@id([list_id, title_id])` dans le schéma |
| 11. GET /shared-lists | **Dans le module lists** — pas de module séparé |
| 12. Réordonnancement | **PATCH** — `/lists/:listId/items/reorder` |

## Dépendances

### Externes
- `auth` → `JwtAuthGuard`, `@CurrentUser()` pour tous les endpoints
- `users` → validation que `shared_with_user_id` existe
- `titles` → validation que `title_id` existe (pour addItem)
- `Prisma` → `user_lists`, `list_items`, `list_shares` (déjà dans PrismaService)

### Schéma Prisma concerné
```prisma
model user_lists {
  id          String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id     String        @db.Uuid
  nom         String
  type        String
  description String?
  created_at  DateTime      @default(now()) @db.Timestamptz(6)
  list_items  list_items[]
  list_shares list_shares[]
  users       users         @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
}

model list_items {
  list_id    String     @db.Uuid
  title_id   String     @db.Uuid
  position   Int?
  added_at   DateTime   @default(now()) @db.Timestamptz(6)
  user_lists user_lists @relation(fields: [list_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  titles     titles     @relation(fields: [title_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@id([list_id, title_id])
}

model list_shares {
  list_id             String     @db.Uuid
  shared_with_user_id String     @db.Uuid
  permission          String     @default("lecture")
  shared_at           DateTime   @default(now()) @db.Timestamptz(6)
  user_lists          user_lists @relation(fields: [list_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  users               users      @relation(fields: [shared_with_user_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@id([list_id, shared_with_user_id])
}
```

## Endpoints

### user_lists (5 endpoints)

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| `POST` | `/lists` | ✅ | `CreateListDto` | Créer une liste |
| `GET` | `/lists` | ✅ | — | Liste des listes de l'utilisateur |
| `GET` | `/lists/:id` | ✅ | — | Détail d'une liste avec ses items (titles) |
| `PATCH` | `/lists/:id` | ✅ | `UpdateListDto` | Modifier nom/description |
| `DELETE` | `/lists/:id` | ✅ | — | Supprimer une liste (cascade items + shares) |

### list_items (3 endpoints)

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| `POST` | `/lists/:listId/items` | ✅ | `AddItemDto` | Ajouter un titre (position = max+1) |
| `DELETE` | `/lists/:listId/items/:titleId` | ✅ | — | Retirer un titre de la liste |
| `PATCH` | `/lists/:listId/items/reorder` | ✅ | `ReorderDto` | Réordonnancement batch |

### list_shares (4 endpoints)

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| `POST` | `/lists/:listId/shares` | ✅ | `ShareListDto` | Partager une liste |
| `GET` | `/lists/:listId/shares` | ✅ | — | Liste des partages d'une liste |
| `DELETE` | `/lists/:listId/shares/:sharedWithUserId` | ✅ | — | Retirer un partage |
| `GET` | `/shared-lists` | ✅ | — | Listes partagées avec l'utilisateur |

## DTOs

```typescript
// CreateListDto
class CreateListDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom!: string;

  @IsEnum(['watchlist', 'favoris', 'custom'])
  type!: 'watchlist' | 'favoris' | 'custom';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

// UpdateListDto
class UpdateListDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

// AddItemDto
class AddItemDto {
  @IsUUID()
  @IsNotEmpty()
  title_id!: string;
}

// ReorderItem (item du tableau)
class ReorderItem {
  @IsUUID()
  title_id!: string;

  @IsInt()
  @Min(0)
  position!: number;
}

// ReorderDto
class ReorderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items!: ReorderItem[];
}

// ShareListDto
class ShareListDto {
  @IsUUID()
  @IsNotEmpty()
  shared_with_user_id!: string;

  @IsEnum(['lecture', 'edition'])
  permission!: 'lecture' | 'edition';
}
```

## Fonctions ListsService

```typescript
class ListsService {
  // user_lists
  createList(userId: string, dto: CreateListDto): Promise<any>
  getUserLists(userId: string): Promise<any[]>
  getListDetail(listId: string, userId: string): Promise<any>  // vérifie accès (owner ou shared)
  updateList(listId: string, userId: string, dto: UpdateListDto): Promise<any>
  deleteList(listId: string, userId: string): Promise<void>

  // list_items
  addItem(listId: string, userId: string, titleId: string): Promise<any>
  removeItem(listId: string, userId: string, titleId: string): Promise<void>
  reorderItems(listId: string, userId: string, dto: ReorderDto): Promise<void>

  // list_shares
  shareList(listId: string, userId: string, dto: ShareListDto): Promise<any>
  getShares(listId: string, userId: string): Promise<any[]>
  removeShare(listId: string, userId: string, sharedWithUserId: string): Promise<void>
  getSharedLists(userId: string): Promise<any[]>

  // Vérification d'accès (utilitaire partagé)
  private async findListOrThrow(listId: string, userId: string): Promise<any>
  // Vérifie que l'utilisateur est propriétaire de la liste (ou a permission 'edition')
  private async checkListAccess(listId: string, userId: string, requireEdit?: boolean): Promise<any>
}
```

### Logique d'accès

| Endpoint | Propriétaire | Partagé (lecture) | Partagé (édition) |
|----------|:-----------:|:-----------------:|:-----------------:|
| GET /lists/:id | ✅ | ✅ | ✅ |
| PATCH /lists/:id | ✅ | ❌ | ❌ (seul le owner modifie les métadonnées) |
| DELETE /lists/:id | ✅ | ❌ | ❌ |
| POST /lists/:listId/items | ✅ | ❌ | ✅ |
| DELETE /lists/:listId/items/:titleId | ✅ | ❌ | ✅ |
| PATCH /lists/:listId/items/reorder | ✅ | ❌ | ✅ |
| POST /lists/:listId/shares | ✅ | ❌ | ❌ |
| GET /lists/:listId/shares | ✅ | ❌ | ❌ |
| DELETE /lists/:listId/shares/:userId | ✅ | ❌ | ❌ |

### Auto-incrément position pour addItem
```typescript
async addItem(listId: string, userId: string, titleId: string) {
  const list = await this.checkListAccess(listId, userId, true);

  // Trouver la position max actuelle
  const lastItem = await this.prisma.list_items.findFirst({
    where: { list_id: listId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const nextPosition = (lastItem?.position ?? -1) + 1;

  return this.prisma.list_items.create({
    data: {
      list_id: listId,
      title_id: titleId,
      position: nextPosition,
    },
    include: {
      titles: {
        select: { id: true, tmdb_id: true, titre_vo: true, titre_vf: true, affiche_url: true },
      },
    },
  });
}
```

## Structure prévue

```
apps/api/src/lists/
├── lists.module.ts
├── lists.controller.ts
├── lists.service.ts
├── dto/
│   ├── create-list.dto.ts
│   ├── update-list.dto.ts
│   ├── add-item.dto.ts
│   ├── reorder.dto.ts
│   └── share-list.dto.ts
└── lists.service.spec.ts
```

## Plan de tests

### createList
- Crée une liste de type 'watchlist'
- Crée une liste de type 'custom'
- Lève BadRequest si type invalide (validation DTO)

### getUserLists
- Retourne les listes de l'utilisateur
- Retourne un tableau vide si aucune liste

### getListDetail
- Retourne la liste avec ses items si propriétaire
- Retourne la liste si partagée en lecture
- Retourne la liste si partagée en édition
- Lève NotFound si la liste n'existe pas
- Lève Forbidden si non propriétaire et non partagée

### updateList / deleteList
- Met à jour/supprime si propriétaire
- Lève Forbidden si non propriétaire

### addItem
- Ajoute un item avec la bonne position (max+1)
- Ajoute le premier item (position=0)
- Lève Forbidden si pas le droit d'édition
- Lève NotFound si le titre n'existe pas

### removeItem
- Retire un item existant
- Lève NotFound si l'item n'existe pas dans la liste

### reorderItems
- Met à jour les positions dans une transaction
- Lève Forbidden si pas le droit d'édition
- Lève NotFound si un title_id n'appartient pas à la liste

### shareList / getShares / removeShare
- Ajoute un partage
- Lève NotFound si shared_with_user_id n'existe pas
- Liste les partages (propriétaire uniquement)
- Retire un partage (propriétaire uniquement)
- Lève Forbidden si non propriétaire

### getSharedLists
- Retourne les listes partagées avec l'utilisateur
- Retourne tableau vide si aucun partage

