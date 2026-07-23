# Contexte — Phase 5.3 : Fallback TMDB pour person_recommendations

## Décisions stratégiques (tranchées)

| Question | Décision | Justification |
|----------|----------|---------------|
| 1. Algorithme TMDB | **(a) Jaccard sur credits partagés** | TMDB n'a pas d'endpoint `/person/{id}/recommendations`. Seule option pour calculer un score : fetch `getPersonCombinedCredits` pour chaque personne, Jaccard sur les titres communs. Cohérent avec Phase 5.1. |
| 2. Où placer la fonction | **(a) `packages/tmdb-sync/src/index.ts`** | Symétrique de `bootstrapRecommendationsFromTmdb` pour les titres, déjà présent dans tmdb-sync. |
| 3. Fallback API | **(a) Oui, fallback TMDB** | Même logique que les titres (Phase 3.3) : si `person_recommendations` est vide, appeler TMDB. Cohérence UX. |
| 4. Max recommandations | **(a) 10** | Cohérent avec le reste (title_recommendations aussi limité à 10). |

## Dépendances

### Externes
- `@emdb/tmdb-client` → `getPersonCombinedCredits(personTmdbId)`
- `@emdb/db` → Prisma : lecture `people` (tmdb_id), écriture `person_recommendations`
- `@emdb/tmdb-sync` → déjà existant, on ajoute une fonction exportée

### Personnes concernées
Seules les personnes qui ont un `tmdb_id` peuvent bénéficier du fallback TMDB (celles importées via Phase 2.3). Les personnes créées manuellement (sans tmdb_id) ne peuvent pas être bootstrapées.

## Algorithme : bootstrapPersonRecommendationsFromTmdb

```typescript
import { getPersonCombinedCredits } from '@emdb/tmdb-client';
import { prisma } from '@emdb/db';

const TMDB_RECOMMENDATION_LIMIT = 10;

/**
 * Bootstrap les recommandations TMDB pour une personne.
 *
 * Stratégie :
 * 1. Fetch getPersonCombinedCredits(personTmdbId) → tous les titres TMDB de cette personne
 * 2. Filtrer les titres déjà présents en local (prisma.titles.findMany)
 * 3. Pour chaque titre local, trouver les autres personnes (credits) qui y ont participé
 * 4. Calculer le score de similarité : nombre de titres communs entre les deux personnes
 *    (Jaccard = intersection / union des credits)
 * 5. Top 10 → person_recommendations
 *
 * @param personId - UUID de la personne en base
 * @returns Nombre de recommandations insérées
 * @throws Error si la personne n'existe pas ou n'a pas de tmdb_id
 */
export async function bootstrapPersonRecommendationsFromTmdb(personId: string): Promise<number> {
  const person = await prisma.people.findUnique({
    where: { id: personId },
    select: { id: true, tmdb_id: true },
  });

  if (!person) {
    throw new Error('Personne introuvable.');
  }

  if (!person.tmdb_id) {
    throw new Error('La personne n\'a pas de tmdb_id, impossible de bootstrap depuis TMDB.');
  }

  // 1. Fetch TMDB combined credits
  const tmdbCredits = await getPersonCombinedCredits(person.tmdb_id);

  // 2. Extraire les TMDB IDs des titres où la personne a participé
  const tmdbTitleIds = new Set<number>();
  for (const credit of [...(tmdbCredits.cast ?? []), ...(tmdbCredits.crew ?? [])]) {
    if (credit.id) {
      tmdbTitleIds.add(credit.id);
    }
  }

  if (tmdbTitleIds.size === 0) {
    return 0; // Aucun credit TMDB → pas de recommandations possibles
  }

  // 3. Trouver les titres locaux correspondant à ces TMDB IDs
  const localTitles = await prisma.titles.findMany({
    where: { tmdb_id: { in: Array.from(tmdbTitleIds) } },
    select: { id: true },
  });

  const localTitleIds = localTitles.map((t) => t.id);
  if (localTitleIds.length === 0) {
    return 0; // Aucun titre local → pas de base pour calculer la similarité
  }

  // 4. Trouver les autres personnes ayant participé aux mêmes titres locaux
  const otherCredits = await prisma.credits.findMany({
    where: {
      title_id: { in: localTitleIds },
      person_id: { not: personId },
      episode_id: null, // Seulement les credits au niveau titre
    },
    select: {
      person_id: true,
      title_id: true,
    },
  });

  // 5. Indexer : Map<person_id, Set<title_id>>
  const personTitles = new Map<string, Set<string>>();
  for (const credit of otherCredits) {
    if (!personTitles.has(credit.person_id)) {
      personTitles.set(credit.person_id, new Set());
    }
    personTitles.get(credit.person_id)!.add(credit.title_id);
  }

  // 6. Calculer le score Jaccard pour chaque personne candidate
  const personTitleSet = new Set(localTitleIds);
  const candidates: Array<{ personId: string; score: number }> = [];

  for (const [otherPersonId, otherTitles] of personTitles) {
    const intersection = new Set([...personTitleSet].filter((x) => otherTitles.has(x)));
    const union = new Set([...personTitleSet, ...otherTitles]);

    const jaccard = intersection.size / union.size;
    if (jaccard > 0) {
      candidates.push({ personId: otherPersonId, score: jaccard });
    }
  }

  // 7. Top 10
  candidates.sort((a, b) => b.score - a.score);
  const top10 = candidates.slice(0, TMDB_RECOMMENDATION_LIMIT);

  // 8. Insérer dans person_recommendations
  const records = top10.map((c) => ({
    person_id: personId,
    recommended_id: c.personId,
    score: parseFloat(c.score.toFixed(4)),
  }));

  if (records.length > 0) {
    await prisma.$transaction(async (tx) => {
      // Supprimer les anciennes recommandations TMDB pour cette personne
      await tx.person_recommendations.deleteMany({
        where: { person_id: personId },
      });

      // Insérer les nouvelles
      await tx.person_recommendations.createMany({
        data: records,
      });
    });
  }

  return records.length;
}
```

## Modifications PeopleService (fallback API)

```typescript
// Dans apps/api/src/people/people.service.ts
// MODIFIER getRecommendations() pour ajouter le fallback TMDB

import { bootstrapPersonRecommendationsFromTmdb } from '@emdb/tmdb-sync';

async getRecommendations(id: string) {
  const person = await this.prisma.people.findUnique({
    where: { id },
    select: { id: true, tmdb_id: true },
  });

  if (!person) {
    throw new NotFoundException('Personne introuvable.');
  }

  // 1. Vérifier les recommandations locales
  const recs = await this.prisma.person_recommendations.findMany({
    where: { person_id: id },
    include: {
      people_person_recommendations_recommended_idTopeople: {
        select: {
          id: true,
          tmdb_id: true,
          nom: true,
          photo_url: true,
          genre: true,
          bio: true,
        },
      },
    },
    orderBy: { score: 'desc' },
  });

  if (recs.length > 0) {
    return recs.map(
      (rec: { people_person_recommendations_recommended_idTopeople: any }) =>
        rec.people_person_recommendations_recommended_idTopeople,
    );
  }

  // 2. Fallback TMDB si pas de recommandations locales
  if (!person.tmdb_id) {
    return [];
  }

  try {
    await bootstrapPersonRecommendationsFromTmdb(id);
  } catch {
    return []; // Silencieux en cas d'échec TMDB
  }

  // 3. Re-lire les recommandations après bootstrap
  const newRecs = await this.prisma.person_recommendations.findMany({
    where: { person_id: id },
    include: {
      people_person_recommendations_recommended_idTopeople: {
        select: {
          id: true,
          tmdb_id: true,
          nom: true,
          photo_url: true,
          genre: true,
          bio: true,
        },
      },
    },
    orderBy: { score: 'desc' },
  });

  return newRecs.map(
    (rec: { people_person_recommendations_recommended_idTopeople: any }) =>
      rec.people_person_recommendations_recommended_idTopeople,
  );
}
```

## Fichiers modifiés

| Fichier | Action | Description |
|---------|--------|-------------|
| `packages/tmdb-sync/src/index.ts` | **Modifier** | Ajouter `bootstrapPersonRecommendationsFromTmdb(personId)` |
| `packages/tmdb-sync/src/index.spec.ts` | **Modifier** | Tester la nouvelle fonction |
| `apps/api/src/people/people.service.ts` | **Modifier** | Ajouter fallback TMDB dans `getRecommendations()` |
| `apps/api/src/people/people.service.spec.ts` | **Modifier** | Tester le fallback TMDB |

## Plan de tests

### bootstrapPersonRecommendationsFromTmdb (tmdb-sync)
- Appelle `getPersonCombinedCredits` et insère des recommandations
- Retourne 0 si la personne n'a pas de tmdb_id
- Retourne 0 si aucun titre local trouvé (tmdbTitleIds vides → 0 titres locaux)
- Limite à 10 recommandations max
- Transaction réutilisable (DELETE + INSERT)
- Lève Error si personne introuvable

### Fallback PeopleService.getRecommendations()
- Si recommandations locales existantes → les retourne (inchangé)
- Si pas de recommandations locales et pas de tmdb_id → tableau vide
- Si pas de recommandations locales et tmdb_id présent → appelle bootstrapPersonRecommendationsFromTmdb
- Si TMDB échoue → ne crashe pas, retourne tableau vide (catch silencieux)
- Après bootstrap réussi → retourne les nouvelles recommandations

