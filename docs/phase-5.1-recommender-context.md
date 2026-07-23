# Contexte — Phase 5.1 : Algorithme de similarité + script de calcul (packages/recommender)

## Décisions stratégiques

| Question | Décision |
|----------|----------|
| 1. Algorithme similarité | **Jaccard pondéré** : Genres (0.6) + Acteurs top 10 (0.3) + Réalisateurs (0.1) |
| 2. Top N recommandations | **10** par titre/personne |
| 3. Où exécuter | **Script** (exécutable manuellement) + **Worker BullMQ** (cron mensuel) |
| 4. Endpoint déclenchement | **POST /admin/compute-recommendations** (authentifié admin) |
| 5. Découpage | 5.1 (algorithme + script) → 5.2 (API + worker) → 5.3 (fallback TMDB) |

## Dépendances

### Externes
- `@emdb/db` — Prisma client pour lecture titles, title_genres, credits, people + écriture title_recommendations, person_recommendations
- Aucune dépendance réseau (TMDB, Wikidata) — calcul 100% local

### Schéma Prisma concerné
```prisma
model titles {
  id          String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  type        String  // 'film' | 'serie'
  // ...
}

model title_genres {
  title_id String @db.Uuid
  genre_id String @db.Uuid
  @@id([title_id, genre_id])
}

model genres {
  id  String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nom String @unique
}

model credits {
  id         String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title_id   String  @db.Uuid
  person_id  String  @db.Uuid
  role_id    String  @db.Uuid
  personnage String?
  ordre      Int?
  // Note: credits peuvent avoir episode_id != null → à filtrer
}

model roles {
  id      String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  code    String @unique  // 'acteur', 'realisateur', 'scenariste', 'autre'
  libelle String
}

model title_recommendations {
  title_id       String   @db.Uuid
  recommended_id String   @db.Uuid
  score          Decimal  @db.Decimal(5, 4)
  generated_at   DateTime @default(now()) @db.Timestamptz(6)
  @@id([title_id, recommended_id])
}

model person_recommendations {
  person_id       String   @db.Uuid
  recommended_id  String   @db.Uuid
  score           Decimal  @db.Decimal(5, 4)
  generated_at    DateTime @default(now()) @db.Timestamptz(6)
  @@id([person_id, recommended_id])
}
```

## Algorithme détaillé : computeTitleRecommendations

### Étape 1 — Chargement des données (1 requête par table)
```typescript
// 1a. Charger tous les titres avec leurs genres
const titlesWithGenres = await prisma.titles.findMany({
  select: {
    id: true,
    type: true,
    title_genres: {
      select: { genre_id: true },
    },
  },
});

// 1b. Indexer : Map<title_id, Set<genre_id>>
const titleGenres = new Map<string, Set<string>>();
for (const t of titlesWithGenres) {
  titleGenres.set(t.id, new Set(t.title_genres.map(tg => tg.genre_id)));
}

// 1c. Charger les credits pour acteurs (top 10 par ordre) + réalisateurs
const credits = await prisma.credits.findMany({
  where: { episode_id: null }, // seulement les credits au niveau titre
  include: {
    roles: { select: { code: true } },
  },
  orderBy: { ordre: 'asc' },
});

// 1d. Indexer : Map<title_id, { actors: Set<person_id>, directors: Set<person_id> }>
const titleCredits = new Map<string, { actors: Set<string>; directors: Set<string> }>();
for (const c of credits) {
  if (!titleCredits.has(c.title_id)) {
    titleCredits.set(c.title_id, { actors: new Set(), directors: new Set() });
  }
  const entry = titleCredits.get(c.title_id)!;
  if (c.roles.code === 'acteur' && entry.actors.size < 10) {
    entry.actors.add(c.person_id);
  } else if (c.roles.code === 'realisateur') {
    entry.directors.add(c.person_id);
  }
}
```

### Étape 2 — Calcul Jaccard pour une paire de titres
```typescript
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function computeScore(
  genresA: Set<string>, genresB: Set<string>,
  actorsA: Set<string>, actorsB: Set<string>,
  directorsA: Set<string>, directorsB: Set<string>,
): number {
  const genreScore = jaccardSimilarity(genresA, genresB) * 0.6;
  const actorScore = jaccardSimilarity(actorsA, actorsB) * 0.3;
  const directorScore = jaccardSimilarity(directorsA, directorsB) * 0.1;
  return genreScore + actorScore + directorScore;
}
```

### Étape 3 — Parcours par batch
```typescript
async function computeTitleRecommendations(batchSize = 100) {
  const allTitleIds = Array.from(titleGenres.keys());
  let totalInserted = 0;

  for (let i = 0; i < allTitleIds.length; i += batchSize) {
    const batch = allTitleIds.slice(i, i + batchSize);

    // Pour chaque titre du batch, calculer les scores avec TOUS les autres titres
    const records: Array<{ title_id: string; recommended_id: string; score: number }> = [];

    for (const titleIdA of batch) {
      const candidates: Array<{ id: string; score: number }> = [];
      const genresA = titleGenres.get(titleIdA)!;
      const creditsA = titleCredits.get(titleIdA) ?? { actors: new Set(), directors: new Set() };

      for (const titleIdB of allTitleIds) {
        if (titleIdA === titleIdB) continue;

        // Optimisation : si aucun genre commun, score = 0, on skip
        const genresB = titleGenres.get(titleIdB)!;
        if (!hasCommonGenre(genresA, genresB)) continue;

        const creditsB = titleCredits.get(titleIdB) ?? { actors: new Set(), directors: new Set() };
        const score = computeScore(
          genresA, genresB,
          creditsA.actors, creditsB.actors,
          creditsA.directors, creditsB.directors,
        );

        if (score > 0) {
          candidates.push({ id: titleIdB, score });
        }
      }

      // Top 10
      candidates.sort((a, b) => b.score - a.score);
      const top10 = candidates.slice(0, 10);

      for (const c of top10) {
        records.push({ title_id: titleIdA, recommended_id: c.id, score: c.score });
      }
    }

    // Transaction : DELETE anciennes + INSERT nouvelles
    if (records.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Supprimer les anciennes recommandations pour les titres du batch
        await tx.title_recommendations.deleteMany({
          where: { title_id: { in: batch.map(t => t) } },
        });

        // Insérer les nouvelles
        await tx.title_recommendations.createMany({
          data: records,
          skipDuplicates: false, // Pas de doublons car on a delete avant
        });
      });
    }

    totalInserted += records.length;
    console.log(`[batch ${i / batchSize + 1}] ${batch.length} titles processed, ${records.length} recs`);
  }

  return totalInserted;
}
```

### Optimisation : `hasCommonGenre`
```typescript
function hasCommonGenre(setA: Set<string>, setB: Set<string>): boolean {
  if (setA.size === 0 || setB.size === 0) return false;
  // Itérer sur le plus petit set
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) return true;
  }
  return false;
}
```

## Algorithme détaillé : computePersonRecommendations

```typescript
async function computePersonRecommendations() {
  // 1. Charger tous les credits groupés par personne
  const credits = await prisma.credits.findMany({
    where: { episode_id: null },
    select: {
      person_id: true,
      title_id: true,
      people: { select: { genre: true } },
    },
  });

  // Index : Map<person_id, { titles: Set<title_id>, genre: string | null }>
  const personData = new Map<string, { titles: Set<string>; genre: string | null }>();
  for (const c of credits) {
    if (!personData.has(c.person_id)) {
      personData.set(c.person_id, {
        titles: new Set(),
        genre: c.people?.genre ?? null,
      });
    }
    personData.get(c.person_id)!.titles.add(c.title_id);
  }

  const personIds = Array.from(personData.keys());
  const records: Array<{ person_id: string; recommended_id: string; score: number }> = [];

  for (let i = 0; i < personIds.length; i++) {
    const pA = personIds[i];
    const dataA = personData.get(pA)!;
    const candidates: Array<{ id: string; score: number }> = [];

    for (let j = i + 1; j < personIds.length; j++) {
      const pB = personIds[j];
      const dataB = personData.get(pB)!;

      const jaccard = jaccardSimilarity(dataA.titles, dataB.titles);
      let score = jaccard;

      // Bonus genre : +0.1 si même genre
      if (dataA.genre && dataB.genre && dataA.genre === dataB.genre) {
        score += 0.1;
      }

      if (score > 0) {
        candidates.push({ id: pB, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const top10 = candidates.slice(0, 10);

    for (const c of top10) {
      records.push({ person_id: pA, recommended_id: c.id, score: c.score });
      records.push({ person_id: c.id, recommended_id: pA, score: c.score });
    }
  }

  // Transaction : DELETE + INSERT
  if (records.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.person_recommendations.deleteMany({});
      await tx.person_recommendations.createMany({ data: records });
    });
  }

  return records.length;
}
```

## Structure prévue

```
packages/recommender/
├── package.json          // name: "@emdb/recommender", dep: "@emdb/db"
├── tsconfig.json
├── src/
│   ├── index.ts          // export computeTitleRecs, computePersonRecs
│   ├── recommender.ts    // algo principal
│   ├── jaccard.ts        // utilitaires Jaccard
│   └── recommender.spec.ts // tests unitaires
└── scripts/
    └── run-recommendations.ts  // CLI exécutable
```

## Plan de tests

### jaccard.ts
- Jaccard similarity entre deux sets identiques → 1
- Jaccard similarity entre deux sets disjoints → 0
- Jaccard similarity entre deux sets avec intersection partielle → valeur correcte
- Jaccard avec un ou deux sets vides → 0

### recommender.ts
- `hasCommonGenre` retourne true si intersection, false sinon
- `computeScore` pondère correctement les 3 facteurs
- `computeTitleRecommendations` pour un titre : retourne max 10 résultats
- `computeTitleRecommendations` ne recommande pas le titre lui-même
- `computeTitleRecommendations` ignore les crédits avec episode_id != null
- `computePersonRecommendations` symétrique (si A recommande B, B recommande A)
- `computePersonRecommendations` bonus genre

