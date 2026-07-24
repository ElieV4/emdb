# Contexte — Phase 7.3 : Nettoyage et maintenance des notifications

## Décisions stratégiques

| Question | Décision | Justification |
|----------|----------|---------------|
| 1. Politique de rétention | **(a) 30 jours pour les lues, 90 jours pour les non lues** | Les notifications lues peuvent être supprimées rapidement (l'utilisateur les a déjà vues). Les non lues sont conservées plus longtemps au cas où l'utilisateur ne s'est pas connecté. |
| 2. Type de suppression | **(a) Hard delete** | Les notifications sont éphémères, pas besoin de soft delete. Un hard delete libère de l'espace en base. |
| 3. Fréquence du nettoyage | **(a) Hebdomadaire pour les lues, mensuelle pour les non lues** | Cohérent avec la politique de rétention. Un job hebdo pour les lues, un job mensuel pour les obsolètes. |
| 4. Queue BullMQ | **(a) Queue `tmdb-cron` existante** | Réutilisation de la queue existante, pas besoin d'une queue dédiée pour un job simple. |
| 5. Reporting | **(a) Log simple** | Le worker logue le nombre de notifications supprimées. Pas besoin de métriques complexes pour un job de maintenance. |

## Dépendances

### Externes
- `@emdb/db` — Prisma : table `notifications`
- `bullmq` — Queue `tmdb-cron` (déjà existante dans le worker)

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

## Fonctions de nettoyage

### Fonction : `cleanOldNotifications()`

Supprime les notifications **lues** de plus de 30 jours.

```typescript
/**
 * Nettoie les notifications lues de plus de 30 jours.
 *
 * Exécution hebdomadaire recommandée.
 *
 * @returns Nombre de notifications supprimées
 */
export async function cleanOldNotifications(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const result = await prisma.notifications.deleteMany({
    where: {
      lu: true,
      created_at: { lt: cutoff },
    },
  });

  return result.count;
}
```

### Fonction : `cleanStaleNotifications()`

Supprime les notifications **non lues** de plus de 90 jours (obsolètes).

```typescript
/**
 * Nettoie les notifications non lues de plus de 90 jours.
 *
 * Ces notifications sont considérées comme obsolètes (ex: épisode vieux de 3 mois).
 *
 * Exécution mensuelle recommandée.
 *
 * @returns Nombre de notifications supprimées
 */
export async function cleanStaleNotifications(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const result = await prisma.notifications.deleteMany({
    where: {
      lu: false,
      created_at: { lt: cutoff },
    },
  });

  return result.count;
}
```

## Intégration dans le worker

Les fonctions de nettoyage sont intégrées dans `apps/worker/src/worker.ts` sous le job `clean-notifications` dans la queue `tmdb-cron`.

### Configuration du job

```typescript
// apps/worker/src/worker.ts (extrait)

/**
 * Worker pour la queue tmdb-cron.
 * Gère les jobs planifiés (daily sync, weekly resync, refresh MV, nettoyage).
 */
export function createCronWorker(redisUrl: string) {
  const worker = new Worker(
    'tmdb-cron',
    async (job) => {
      switch (job.name) {
        case 'daily-sync-new-episodes':
          // ... logique existante ...
          break;

        case 'weekly-resync-changes':
          // ... logique existante ...
          break;

        case 'refresh-materialized-views':
          // ... logique existante ...
          break;

        case 'clean-notifications':
          // NOUVEAU : nettoyage des notifications
          const oldDeleted = await cleanOldNotifications();
          const staleDeleted = await cleanStaleNotifications();
          logger.log(
            `Nettoyage notifications : ${oldDeleted} lues (>30j) + ${staleDeleted} non lues (>90j) supprimées`,
          );
          return {
            old_notifications_deleted: oldDeleted,
            stale_notifications_deleted: staleDeleted,
          };
      }
    },
    {
      connection: { host: process.env.REDIS_HOST ?? 'localhost' },
      concurrency: 1,
    },
  );

  return worker;
}
```

### Planification du cron

```typescript
// apps/worker/src/worker.ts (extrait)

/**
 * Planifie les jobs cron périodiques.
 */
export async function ensureRepeatableCronJobs(cronQueue: Queue) {
  // ... jobs existants ...

  // NOUVEAU : nettoyage hebdomadaire des notifications (tous les dimanches à 4h)
  await cronQueue.upsertJobScheduler(
    'clean-notifications-cron-weekly',
    { pattern: '0 4 * * 0' },  // cron: dimanche à 4h du matin
    {
      name: 'clean-notifications',
      data: {},
      opts: { jobId: 'clean-notifications-cron-weekly' },
    },
  );
}
```

### Logging

Le worker logue les résultats du nettoyage pour le monitoring :

```typescript
logger.log(
  `Nettoyage notifications : ${oldDeleted} lues (>30j) + ${staleDeleted} non lues (>90j) supprimées`,
);
```

En cas d'absence de suppression (0 notifications), un simple log INFO. Pas d'alerte nécessaire (c'est normal si les utilisateurs lisent leurs notifications).

## Fichiers modifiés

### apps/worker
| Fichier | Action | Description |
|---------|--------|-------------|
| `src/worker.ts` | **Modifier** | Ajouter le job `clean-notifications`, les fonctions `cleanOldNotifications` et `cleanStaleNotifications`, et la planification cron |
| `src/worker.spec.ts` | **Modifier** | Ajouter les tests pour les fonctions de nettoyage |

## Plan de tests

### cleanOldNotifications
- Supprime les notifications lues de plus de 30 jours
- Ne supprime pas les notifications lues de moins de 30 jours
- Ne supprime pas les notifications non lues (quel que soit leur âge)
- Retourne 0 si aucune notification à supprimer

### cleanStaleNotifications
- Supprime les notifications non lues de plus de 90 jours
- Ne supprime pas les notifications non lues de moins de 90 jours
- Ne supprime pas les notifications lues (quel que soit leur âge)
- Retourne 0 si aucune notification à supprimer

### Intégration worker
- Le job `clean-notifications` appelle les deux fonctions de nettoyage
- Le job logue correctement le nombre de notifications supprimées
- La planification cron `clean-notifications-cron-weekly` est correctement configurée (dimanche à 4h)

## Critères d'acceptation

1. [ ] Les notifications lues de plus de 30 jours sont automatiquement supprimées
2. [ ] Les notifications non lues de plus de 90 jours sont automatiquement supprimées
3. [ ] Les notifications récentes (lues < 30j, non lues < 90j) sont conservées
4. [ ] Le job de nettoyage est exécuté automatiquement chaque semaine (dimanche à 4h)
5. [ ] Le nombre de notifications supprimées est loggé
6. [ ] Le nettoyage n'affecte pas les autres fonctionnalités (watches, ratings, etc.)
7. [ ] Tous les tests passent

## Métriques de monitoring

| Métrique | Valeur normale | Alerte |
|----------|---------------|--------|
| `cleanOldNotifications.count` | 0-1000/semaine | >10 000 (table anormalement volumineuse) |
| `cleanStaleNotifications.count` | 0-100/mois | >1000 (beaucoup d'utilisateurs inactifs) |

## Dépendances

### Entre sous-phases
- Phase 7.3 **dépend de** Phase 7.1 (le modèle `notifications` doit exister)
- Phase 7.3 **dépend de** Phase 7.2 (les notifications doivent être générées avant d'être nettoyées)

### Ordre d'exécution recommandé
1. Phase 7.1 (module API)
2. Phase 7.2 (génération)
3. **Phase 7.3 (nettoyage)** — en dernier

## Documentation

- [ ] Mettre à jour `ARCHITECTURE_OVERVIEW.md` (jobs worker)
- [ ] Mettre à jour `emdb_roadmap_backend.md` (Phase 7.3 cochée)
- [ ] Mettre à jour `docs/README.md` (lien vers ce document)