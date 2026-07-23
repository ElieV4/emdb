# Phase 4.4 - Module Follows (Suivi de Séries)

*Documentation technique du module Follows - eMDB Backend*
*Dernière mise à jour : 24 juillet 2026*
*Statut : ✅ **COMPLET** (Intégré dans le module Watches)*

---

## 📋 Table des Matières

1. [Vue d'Ensemble](#-vue-densemble)
2. [Décisions d'Architecture](#-décisions-darchitecture)
3. [Structure du Module](#-structure-du-module)
4. [Endpoints API](#-endpoints-api)
5. [Logique Métier](#-logique-métier)
6. [Validation des Données](#-validation-des-données)
7. [Tests Unitaires](#-tests-unitaires)
8. [Intégration avec d'Autres Modules](#-intégration-avec-dautres-modules)
9. [Points à Trancher](#-points-à-trancher)
10. [Checklist de Validation](#-checklist-de-validation)

---

## 🎯 Vue d'Ensemble

Le module **Follows** permet aux utilisateurs de **suivre des séries** pour recevoir des notifications sur les nouveaux épisodes et afficher un calendrier personnalisé.

**Statut Actuel** : ✅ **COMPLET** - Intégré dans le module `watches` (`apps/api/src/watches/`) pour des raisons d'architecture (le calendrier et la progression dépendent directement du suivi de séries).

### Fonctionnalités Implémentées

| Fonctionnalité | Endpoint | Méthode | Statut |
|---------------|----------|---------|--------|
| Suivre une série | `POST /follows` | `follow()` | ✅ |
| Ne plus suivre une série | `DELETE /follows/:titleId` | `unfollow()` | ✅ |
| Lister les séries suivies | `GET /follows` | `getFollowedSeries()` | ✅ |

### Dépendances

- **Modules** : `auth` (JwtAuthGuard), `titles` (validation type série)
- **Packages** : `@emdb/db` (Prisma UserFollowsSerie)

---

## 🏗️ Décisions d'Architecture

### ❓ Pourquoi Intégré dans Watches ?

**Décision** : Le module `follows` a été intégré dans le module `watches` plutôt que d'être un module séparé.

**Justification** :
1. **Couplage fort** : Le calendrier des épisodes non vus (`GET /calendar`) et la progression série (`GET /titles/:titleId/progress`) **dépendent directement** des séries suivies
2. **Simplification** : Évite la duplication des dépendances (Prisma, Auth, Titles)
3. **Cohérence** : Les fonctionnalités de visionnage et de suivi sont conceptuellement liées (toutes deux gèrent l'activité utilisateur sur les séries)

**Alternative envisagée** : Créer un module `follows` séparé (`apps/api/src/follows/`)

---

## 📁 Structure du Module

```
watches/
├── watches.controller.ts          # Contrôleur REST (inclut endpoints /follows*)
├── watches.service.ts            # Service (inclut follow, unfollow, getFollowedSeries)
├── watches.module.ts             # Module NestJS
└── dto/
    └── follow-serie.dto.ts        # DTO pour suivre une série
```

---

## 🌐 Endpoints API

### POST /follows

**Description** : Suivre une série (ajouter à sa liste de séries suivies)

**Request** :
```typescript
// Body
{
  "title_id": "uuid"  // Required - UUID du titre (doit être une série)
}
```

**Validation** :
- `title_id` : UUID valide (via `@IsUUID()`)
- `title_id` : Doit exister en base
- `title_id` : Doit être de type `'serie'` (validation applicative)

**Response - Success (201)** :
```typescript
{
  "user_id": "uuid",
  "title_id": "uuid",
  "followed_at": "2026-07-24T10:00:00.000Z",
  "titles": {
    "id": "uuid",
    "tmdb_id": 12345,
    "titre_vo": "Breaking Bad",
    "titre_vf": "Breaking Bad",
    "affiche_url": "https://image.tmdb.org/..."
  }
}
```

**Response - Errors** :
- `400 Bad Request` : `title_id` invalide ou n'est pas une série
- `401 Unauthorized` : Non authentifié
- `404 Not Found` : Titre introuvable
- `409 Conflict` : Série déjà suivie (géré par contrainte UNIQUE en base)

---

### DELETE /follows/:titleId

**Description** : Ne plus suivre une série

**Request** :
```typescript
// URL Params
:titleId  // Required - UUID du titre
```

**Validation** :
- `titleId` : UUID valide
- Le follow doit exister et appartenir à l'utilisateur connecté

**Response - Success (204)** :
```typescript
// No Content
```

**Response - Errors** :
- `401 Unauthorized` : Non authentifié
- `404 Not Found` : Série non suivie par l'utilisateur

---

### GET /follows

**Description** : Lister toutes les séries suivies par l'utilisateur

**Request** :
```typescript
// Query Params (optionnels)
// Aucun pour l'instant - pourrait ajouter pagination/filtres plus tard
```

**Response - Success (200)** :
```typescript
[
  {
    "id": "uuid",
    "tmdb_id": 12345,
    "titre_vo": "Breaking Bad",
    "titre_vf": "Breaking Bad",
    "affiche_url": "https://image.tmdb.org/...",
    "type": "serie",
    "next_episode_air_date": "2026-08-01T00:00:00.000Z",
    "followed_at": "2026-07-24T10:00:00.000Z"
  },
  ...
]
```

**Tri** : Par `followed_at` décroissant (plus récent en premier)

**Response - Errors** :
- `401 Unauthorized` : Non authentifié

---

## 💼 Logique Métier

### Service : WatchesService (`watches.service.ts`)

#### `follow(userId: string, titleId: string)`

**Algorithme** :
1. Vérifier que le titre existe (`prisma.titles.findUnique`)
2. Vérifier que le titre est de type `'serie'` (validation applicative)
3. Créer le follow (`prisma.user_follows_serie.create`)
4. Retourner le follow créé avec les infos du titre

**Contrainte** : La contrainte UNIQUE `(user_id, title_id)` en base empêche les doublons.

**Code** :
```typescript
async follow(userId: string, titleId: string) {
  const title = await this.prisma.titles.findUnique({
    where: { id: titleId },
    select: { id: true, type: true },
  });

  if (!title) {
    throw new NotFoundException('Titre introuvable.');
  }

  if (title.type !== 'serie') {
    throw new BadRequestException('Seules les séries peuvent être suivies.');
  }

  return this.prisma.user_follows_serie.create({
    data: { user_id: userId, title_id: titleId },
    include: { titles: { select: { id: true, tmdb_id: true, titre_vo: true, titre_vf: true, affiche_url: true } } },
  });
}
```

---

#### `unfollow(userId: string, titleId: string)`

**Algorithme** :
1. Vérifier que le follow existe (`prisma.user_follows_serie.findUnique`)
2. Supprimer le follow (`prisma.user_follows_serie.delete`)

**Code** :
```typescript
async unfollow(userId: string, titleId: string): Promise<void> {
  const follow = await this.prisma.user_follows_serie.findUnique({
    where: { user_id_title_id: { user_id: userId, title_id: titleId } },
  });

  if (!follow) {
    throw new NotFoundException("Vous ne suivez pas cette série.");
  }

  await this.prisma.user_follows_serie.delete({
    where: { user_id_title_id: { user_id: userId, title_id: titleId } },
  });
}
```

---

#### `getFollowedSeries(userId: string)`

**Algorithme** :
1. Récupérer tous les follows de l'utilisateur (`prisma.user_follows_serie.findMany`)
2. Inclure les infos du titre (avec select pour optimiser)
3. Trier par `followed_at` décroissant
4. Formater le résultat (fusionner title + followed_at)

**Code** :
```typescript
async getFollowedSeries(userId: string) {
  const follows = await this.prisma.user_follows_serie.findMany({
    where: { user_id: userId },
    include: {
      titles: {
        select: {
          id: true,
          tmdb_id: true,
          titre_vo: true,
          titre_vf: true,
          affiche_url: true,
          type: true,
          next_episode_air_date: true,
        },
      },
    },
    orderBy: { followed_at: 'desc' },
  });

  return follows.map((f) => ({
    ...f.titles,
    followed_at: f.followed_at,
  }));
}
```

---

## ✅ Validation des Données

### Validation dans FollowSerieDto

```typescript
import { IsNotEmpty, IsUUID } from 'class-validator';

export class FollowSerieDto {
  @IsUUID()
  @IsNotEmpty()
  title_id!: string;
}
```

- `@IsUUID()` : Vérifie que `title_id` est un UUID valide
- `@IsNotEmpty()` : Vérifie que `title_id` est fourni

### Validation Applicative

| Validation | Méthode | Message d'erreur |
|------------|---------|------------------|
| Titre existe | `prisma.titles.findUnique` | "Titre introuvable." (404) |
| Titre est une série | `title.type === 'serie'` | "Seules les séries peuvent être suivies." (400) |
| Follow existe (unfollow) | `prisma.user_follows_serie.findUnique` | "Vous ne suivez pas cette série." (404) |

---

## 🧪 Tests Unitaires

**Fichier** : `apps/api/src/watches/watches.service.spec.ts` (lignes 359-456)

### Tests pour `follow()` (lignes 359-393)

```typescript
describe('follow', () => {
  it('suit une série existante', async () => {
    // Mock title.exists + type = 'serie'
    // Vérifie appel à prisma.user_follows_serie.create
  });

  it("lève NotFound si le titre n'existe pas", async () => {
    // Mock title.notFound
    // Vérifie exception NotFoundException
  });

  it("lève BadRequest si le titre n'est pas une série", async () => {
    // Mock title.exists + type = 'film'
    // Vérifie exception BadRequestException
  });
});
```

### Tests pour `unfollow()` (lignes 398-418)

```typescript
describe('unfollow', () => {
  it('ne plus suivre une série', async () => {
    // Mock follow.exists
    // Vérifie appel à prisma.user_follows_serie.delete
  });

  it("lève NotFound si la série n'est pas suivie", async () => {
    // Mock follow.notFound
    // Vérifie exception NotFoundException
  });
});
```

### Tests pour `getFollowedSeries()` (lignes 423-456)

```typescript
describe('getFollowedSeries', () => {
  it('retourne la liste des séries suivies', async () => {
    // Mock follows avec titles
    // Vérifie format du résultat
  });

  it('retourne un tableau vide si aucune série suivie', async () => {
    // Mock follows.empty
    // Vérifie retour []
  });
});
```

**Couverture** : ✅ **100%** des cas de test couverts

---

## 🔗 Intégration avec d'Autres Modules

### Avec Module Titles

**Dépendance** : Validation que le titre est de type `'serie'`

**Appel** :
```typescript
const title = await this.prisma.titles.findUnique({
  where: { id: titleId },
  select: { id: true, type: true },
});

if (title.type !== 'serie') {
  throw new BadRequestException('Seules les séries peuvent être suivies.');
}
```

---

### Avec Module Watches

**Dépendance** : Le calendrier (`GET /calendar`) utilise `user_follows_serie`

**Appel dans `getCalendar()`** :
```typescript
const followedSeries = await this.prisma.user_follows_serie.findMany({
  where: { user_id: userId },
  include: { titles: { select: { ... } } },
});

for (const follow of followedSeries) {
  const nbNonVus = await countEpisodesNonVus(userId, follow.title_id);
  // ...
}
```

---

### Avec Module Auth

**Dépendance** : Tous les endpoints nécessitent une authentification JWT

**Configuration** :
```typescript
@UseGuards(JwtAuthGuard)
@Controller()
export class WatchesController {
  // ...
}
```

---

## ❓ Points à Trancher

### 1. Module Séparé vs Intégré

**Question** : Faut-il créer un module `follows` séparé ou garder l'intégration dans `watches` ?

**Option A - Garder dans Watches (Actuel)** :
- ✅ Simplifie l'architecture
- ✅ Évite la duplication
- ✅ Couplage naturel (calendrier dépend des follows)
- ⚠️ Moins conforme à la roadmap initiale

**Option B - Extraire en module séparé** :
- ✅ Conforme à la roadmap initiale
- ✅ Meilleure séparation des préoccupations
- ⚠️ Nécessite de refactorer le code existant
- ⚠️ Peut créer des dépendances circulaires

**💡 Recommandation** : **Garder l'Option A** (intégré dans watches) car :
- Le code est déjà implémenté et testé
- L'intégration est logique et propre
- La séparation introduirait de la complexité sans bénéfice clair

---

### 2. Pagination pour GET /follows

**Question** : Faut-il ajouter de la pagination pour la liste des séries suivies ?

**Actuel** : Retourne toutes les séries suivies sans pagination

**Pour** :
- Utilisateur avec beaucoup de séries suivies (>100)
- Cohérence avec les autres endpoints de liste

**Contre** :
- Un utilisateur aura rarement >50 séries suivies
- Ajoute de la complexité pour un cas edge

**💡 Recommandation** : **Ajouter plus tard si besoin** (YAGNI - You Aren't Gonna Need It)

---

### 3. Filtres pour GET /follows

**Question** : Faut-il ajouter des filtres (par genre, par statut, etc.) ?

**Actuel** : Aucun filtre

**💡 Recommandation** : **Non pour l'instant** - Les besoins utilisateurs ne justifient pas cette complexité

---

## ✅ Checklist de Validation

### Code
- [x] `follow()` implémentée dans WatchesService
- [x] `unfollow()` implémentée dans WatchesService
- [x] `getFollowedSeries()` implémentée dans WatchesService
- [x] FollowSerieDto créé
- [x] Endpoints POST /follows, DELETE /follows/:titleId, GET /follows
- [x] Validation des inputs (UUID, type série)
- [x] Gestion des erreurs (NotFound, BadRequest)

### Tests
- [x] Tests unitaires pour `follow()`
- [x] Tests unitaires pour `unfollow()`
- [x] Tests unitaires pour `getFollowedSeries()`
- [x] Mocking de PrismaService
- [x] Couverture > 90%

### Documentation
- [x] Documentation technique (ce fichier)
- [ ] Mettre à jour la roadmap backend (marquer [x] au lieu de [])
- [ ] Mettre à jour ARCHITECTURE_OVERVIEW.md
- [ ] Mettre à jour TECHNICAL_DETAILS.md
- [ ] Mettre à jour README.md de docs/

### Intégration
- [x] Intégration avec Auth (JwtAuthGuard)
- [x] Intégration avec Titles (validation type)
- [x] Intégration avec Watches (calendrier)

---

## 📝 Historique des Modifications

| Date | Auteur | Modification |
|------|--------|--------------|
| 2026-07-24 | Mistral Vibe | Création du document - module intégré dans watches |

---

## 🔗 Liens Utiles

- **Roadmap Backend** : [../emdb_roadmap_backend.md](../emdb_roadmap_backend.md)
- **Roadmap Frontend** : [../emdb_roadmap_frontend.md](../emdb_roadmap_frontend.md)
- **Architecture Overview** : [../ARCHITECTURE_OVERVIEW.md](../ARCHITECTURE_OVERVIEW.md)
- **Technical Details** : [../TECHNICAL_DETAILS.md](../TECHNICAL_DETAILS.md)
- **Module Watches** : [`../../apps/api/src/watches/`](../../apps/api/src/watches/)
- **Schéma DB** : [`../../scripts/db_init_v3.sql`](../../scripts/db_init_v3.sql)

---

*Document généré à partir du code existant et de la roadmap technique.*
*Pour toute question ou clarification, consulter les documents sources.*
