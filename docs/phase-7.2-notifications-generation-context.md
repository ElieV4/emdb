# Contexte — Phase 7.2 : Génération des notifications (worker + tmdb-sync)

## Décisions stratégiques

| Question | Décision | Justification |
|----------|----------|---------------|
| 1. Déclencheur | **(a) Dans `dailySyncNewEpisodes`** | Cette fonction existe déjà dans `packages/tmdb-sync` et parcourt les titres en cours chaque jour. C'est le point d'entrée idéal pour ajouter la génération de notifications. |
| 2. Fréquence | **(a) Quotidienne (cron `daily-sync-new-episodes`)** | Cohérent avec le cycle de synchronisation TMDB. Un nouvel épisode sorti sera notifié dans les 24h. |
| 3. Types de notifications | **(a) 3 types** | `new_episode` (nouvel épisode), `season_premiere` (nouvelle saison), `series_return` (retour de série). Distinction utile pour l'affichage frontend. |
| 4. Déduplication | **(a) Vérification existante par `(episode_id, type)`** | Évite de créer des notifications en double si le job est relancé. Vérification simple avant insert. |
| 5. Transaction | **(a) `createMany` sans transaction** | Chaque série est traitée indépendamment. Si une échoue, les autres continuent. Pas de risque de cohérence globale. |

## Dépendances

### Packages
- `@emdb/db` — Prisma : notifications, user_follows_serie, titles, episodes
- `@emdb/tmdb-sync` — La fonction `dailySyncNewEpisodes()` existe déjà, va être enrichie

### Schéma Prisma concerné
```prisma
model notifications {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id    String    @db.Uuid
  episode_id String?   @db.Uuid
  type       String    // 'new_episode' | 'season_premiere' | 'series_return'
  lu         Boolean   @default(false)
  created_at DateTime  @default(now()) @db.Timestamptz(6)
  episodes   episodes? @relation(fields: [episode_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  users      users     @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
}
```

## Algorithme de génération

### Fonction principale : `generateNewEpisodeNotifications()`

Cette fonction est ajoutée dans `packages/tmdb-sync/src/index.ts` et appelée par `dailySyncNewEpisodes()`.

```typescript
/**
 * Génère des notifications pour les nouveaux épisodes des séries suivies.
 *
 * Algorithme :
 * 1. Récupérer toutes les séries en cours avec un prochain épisode prévu
 * 2. Pour chaque série, trouver les utilisateurs qui la suivent
 * 3. Trouver le dernier épisode sorti non encore notifié
 * 4. Créer une notification par follower
 *
 * @returns Nombre total de notifications créées
 */
export async function generateNewEpisodeNotifications(): Promise<number> {
  // 1. Séries en cours avec next_episode_air_date <= aujourd'hui
  const series = await prisma.titles.findMany({
    where: {
      type: 'serie',
      statut_serie: { in: ['en_cours', 'retourne'] },
      next_episode_air_date: { lte: new Date() },
    },
    select: { id: true, titre_vo: true },
  });

  if (series.length === 0) return 0;

  let totalNotifications = 0;

  for (const serie of series) {
    // 2. Followers de la série
    const followers = await prisma.user_follows_serie.findMany({
      where: { title_id: serie.id },
      select: { user_id: true },
    });

    if (followers.length === 0) continue;

    // 3. Dernier épisode sorti
    const latestEpisode = await prisma.episodes.findFirst({
      where: {
        season: { title_id: serie.id },
        date_sortie: { lte: new Date() },
      },
      orderBy: { date_sortie: 'desc' },
      select: { id: true, numero: true, titre: true },
    });

    if (!latestEpisode) continue;

    // 4. Vérifier si déjà notifié (déduplication)
    const existingNotif = await prisma.notifications.findFirst({
      where: {
        episode_id: latestEpisode.id,
        type: 'new_episode',
      },
    });

    if (existingNotif) continue;

    // 5. Créer une notification pour chaque follower
    const notifications = followers.map((f) => ({
      user_id: f.user_id,
      episode_id: latestEpisode.id,
      type: 'new_episode',
      lu: false,
    }));

    await prisma.notifications.createMany({ data: notifications });
    totalNotifications += notifications.length;
  }

  return totalNotifications;
}
```

### Fonction auxiliaire : `generateSeasonPremiereNotifications()`

Pour détecter les premières d'une nouvelle saison (utile pour les séries saisonnières).

```typescript
/**
 * Génère des notifications pour les premières de saison.
 *
 * Déclenché quand une nouvelle saison est importée pour une série suivie.
 *
 * @param titleId - UUID de la série
 * @param seasonNumber - Numéro de la nouvelle saison
 * @returns Nombre de notifications créées
 */
export async function generateSeasonPremiereNotification(
  titleId: string,
  seasonNumber: number,
): Promise<number> {
  // Trouver les followers
  const followers = await prisma.user_follows_serie.findMany({
    where: { title_id: titleId },
    select: { user_id: true },
  });

  if (followers.length === 0) return 0;

  // Trouver le premier épisode de cette saison
  const firstEpisode = await prisma.episodes.findFirst({
    where: {
      season: { title_id: titleId, numero: seasonNumber },
    },
    orderBy: { numero: 'asc' },
    select: { id: true },
  });

  if (!firstEpisode) return 0;

  // Vérifier si déjà notifié
  const existingNotif = await prisma.notifications.findFirst({
    where: {
      episode_id: firstEpisode.id,
      type: 'season_premiere',
    },
  });

  if (existingNotif) return 0;

  // Créer les notifications
  const notifications = followers.map((f) => ({
    user_id: f.user_id,
    episode_id: firstEpisode.id,
    type: 'season_premiere',
    lu: false,
  }));

  await prisma.notifications.createMany({ data: notifications });
  return notifications.length;
}
```

### Intégration dans `dailySyncNewEpisodes()`

La fonction existante `dailySyncNewEpisodes()` est enrichie pour appeler `generateNewEpisodeNotifications()` après le refresh des titres.

```typescript
// Dans packages/tmdb-sync/src/index.ts

/**
 * Synchronisation quotidienne : refresh des titres en cours + notifications.
 *
 * (Fonction existante, enrichie pour la Phase 7.2)
 */
export async function dailySyncNewEpisodes(): Promise<DailySyncResult> {
  // ... logique existante de refresh des titres ...

  // NOUVEAU : générer les notifications pour les nouveaux épisodes
  const notificationsCreated = await generateNewEpisodeNotifications();

  return {
    titlesRefreshed,
    notificationsCreated,
    // ... autres métriques existantes ...
  };
}
```

## Intégration dans le worker

### Job `daily-sync-new-episodes` enrichi

Le job existant dans `apps/worker/src/worker.ts` est mis à jour :

```typescript
// apps/worker/src/worker.ts (extrait)
import { dailySyncNewEpisodes } from '@emdb/tmdb-sync';

// Dans le handler du job 'daily-sync-new-episodes'
const result = await dailySyncNewEpisodes();
logger.log(`Sync quotidien : ${result.titlesRefreshed} titres, ${result.notificationsCreated} notifications`);
```

### Nouveau job `generate-notifications` (optionnel)

Si on veut pouvoir déclencher la génération indépendamment du sync TMDB :

```typescript
// apps/worker/src/worker.ts (extrait)

// Queue tmdb-cron : nouveau job 'generate-notifications'
case 'generate-notifications': {
  const count = await generateNewEpisodeNotifications();
  logger.log(`Notifications générées : ${count}`);
  return { notificationsCreated: count };
}
```

## Types de notifications

| Type | Déclencheur | Contenu attendu (frontend) | Priorité |
|------|-------------|---------------------------|----------|
| `new_episode` | Nouvel épisode d'une série suivie | "Nouvel épisode de [Série] : S[XX]E[YY] - [Titre]" | Haute |
| `season_premiere` | Première d'une nouvelle saison | "La saison [N] de [Série] est disponible" | Haute |
| `series_return` | Retour d'une série en pause | "[Série] est de retour ! Nouvel épisode disponible" | Moyenne |

## Fichiers modifiés

### packages/tmdb-sync
| Fichier | Action | Description |
|---------|--------|-------------|
| `src/index.ts` | **Modifier** | Ajouter `generateNewEpisodeNotifications()`, `generateSeasonPremiereNotification()`, enrichir `dailySyncNewEpisodes()` |
| `src/index.spec.ts` | **Modifier** | Ajouter les tests pour les nouvelles fonctions |

### apps/worker
| Fichier | Action | Description |
|---------|--------|-------------|
| `src/worker.ts` | **Modifier** | Enrichir le job `daily-sync-new-episodes`, ajouter optionnellement le job `generate-notifications` |
| `src/worker.spec.ts` | **Modifier** | Ajouter les tests pour la génération de notifications dans le worker |

## Plan de tests

### generateNewEpisodeNotifications
- Crée des notifications pour les followers d'une série avec un nouvel épisode
- Ne crée pas de doublon (vérification existante par episode_id + type)
- Ignore les séries sans followers
- Ignore les séries sans nouvel épisode (next_episode_air_date dans le futur)
- Ignore les séries dont le statut n'est pas 'en_cours' ou 'retourne'

### generateSeasonPremiereNotification
- Crée des notifications pour la première d'une nouvelle saison
- Ne crée pas de doublon
- Ignore si la saison n'a pas d'épisodes

### dailySyncNewEpisodes (enrichie)
- La fonction enrichie retourne `notificationsCreated` dans le résultat
- La génération de notifications ne bloque pas le refresh des titres

### Intégration worker
- Le job `daily-sync-new-episodes` appelle `dailySyncNewEpisodes()` et logue le nombre de notifications
- Le job `generate-notifications` (optionnel) appelle `generateNewEpisodeNotifications()` directement

## Critères d'acceptation

1. [ ] Une notification est créée pour chaque follower d'une série quand un nouvel épisode sort
2. [ ] Aucune notification en double n'est créée si le job est relancé
3. [ ] Les séries sans followers ne génèrent pas de notifications
4. [ ] Les séries sans nouvel épisode ne génèrent pas de notifications
5. [ ] La fonction `dailySyncNewEpisodes()` continue de fonctionner comme avant (rétrocompatibilité)
6. [ ] Le nombre de notifications créées est retourné dans les métriques du job
7. [ ] Tous les tests passent

## Dépendances

### Entre sous-phases
- Phase 7.2 **dépend de** Phase 7.1 (le modèle `notifications` est déjà utilisé)
- Phase 7.2 **est indépendante** de Phase 7.3 (peut être faite en parallèle)

### Entre modules
- `packages/tmdb-sync` → `@emdb/db` (Prisma)
- `apps/worker` → `@emdb/tmdb-sync`

## Documentation

- [ ] Mettre à jour `ARCHITECTURE_OVERVIEW.md` (flux notifications, jobs worker)
- [ ] Mettre à jour `emdb_roadmap_backend.md` (Phase 7.2 cochée)
- [ ] Mettre à jour `docs/README.md` (lien vers ce document)