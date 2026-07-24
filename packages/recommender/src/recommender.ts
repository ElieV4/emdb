/**
 * eMDB Recommender - Main Recommendation Algorithm
 * Phase 5.1: Algorithme de similarité pour titres et personnes
 *
 * Implémente la similarité Jaccard pondérée :
 * - Genres partagés : poids 0.6
 * - Acteurs partagés (top 10) : poids 0.3
 * - Réalisateurs partagés : poids 0.1
 */

import { PrismaClient } from '@emdb/db';
import { jaccardSimilarity, hasCommonGenre } from './jaccard';

// Type pour les crédits indexés par titre
type TitleCredits = {
  actors: Set<string>;
  directors: Set<string>;
};

// Type pour les données personne
type PersonData = {
  titles: Set<string>;
  genre: string | null;
};

// Type pour les recommandations
type TitleRecommendation = {
  title_id: string;
  recommended_id: string;
  score: number;
};

type PersonRecommendation = {
  person_id: string;
  recommended_id: string;
  score: number;
};

const prisma = new PrismaClient();

/**
 * Calcule le score de similarité pondéré entre deux titres
 *
 * @param genresA - Genres du titre A
 * @param genresB - Genres du titre B
 * @param actorsA - Acteurs du titre A (top 10)
 * @param actorsB - Acteurs du titre B (top 10)
 * @param directorsA - Réalisateurs du titre A
 * @param directorsB - Réalisateurs du titre B
 * @returns Score entre 0 et 1
 */
function computeTitleScore(
  genresA: Set<string>,
  genresB: Set<string>,
  actorsA: Set<string>,
  actorsB: Set<string>,
  directorsA: Set<string>,
  directorsB: Set<string>,
): number {
  const genreScore = jaccardSimilarity(genresA, genresB) * 0.6;
  const actorScore = jaccardSimilarity(actorsA, actorsB) * 0.3;
  const directorScore = jaccardSimilarity(directorsA, directorsB) * 0.1;
  return genreScore + actorScore + directorScore;
}

/**
 * Charge tous les titres avec leurs genres depuis la base de données
 *
 * @returns Map title_id -> Set<genre_id>
 */
async function loadTitleGenres(): Promise<Map<string, Set<string>>> {
  const titlesWithGenres = await prisma.titles.findMany({
    select: {
      id: true,
      title_genres: {
        select: { genre_id: true },
      },
    },
  });

  const titleGenres = new Map<string, Set<string>>();
  for (const t of titlesWithGenres) {
    titleGenres.set(t.id, new Set(t.title_genres.map((tg) => tg.genre_id)));
  }

  return titleGenres;
}

/**
 * Charge les crédits pour acteurs (top 10) et réalisateurs depuis la base de données
 * Filtre les crédits au niveau titre (episode_id = null)
 *
 * @returns Map title_id -> { actors: Set<person_id>, directors: Set<person_id> }
 */
async function loadTitleCredits(): Promise<Map<string, TitleCredits>> {
  const credits = await prisma.credits.findMany({
    where: { episode_id: null },
    include: {
      roles: { select: { code: true } },
    },
    orderBy: { ordre: 'asc' },
  });

  const titleCredits = new Map<string, TitleCredits>();
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

  return titleCredits;
}

/**
 * Calcule les recommandations de titres similaires pour tous les titres
 * Utilise un traitement par batch pour éviter les problèmes de mémoire
 *
 * @param batchSize - Taille du batch (par défaut 100)
 * @returns Nombre total de recommandations insérées
 */
export async function computeTitleRecommendations(batchSize: number = 100): Promise<number> {
  const titleGenres = await loadTitleGenres();
  const titleCredits = await loadTitleCredits();

  const allTitleIds = Array.from(titleGenres.keys());
  let totalInserted = 0;

  for (let i = 0; i < allTitleIds.length; i += batchSize) {
    const batch = allTitleIds.slice(i, i + batchSize);
    const records: TitleRecommendation[] = [];

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
        const score = computeTitleScore(
          genresA,
          genresB,
          creditsA.actors,
          creditsB.actors,
          creditsA.directors,
          creditsB.directors,
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
          where: { title_id: { in: batch } },
        });

        // Insérer les nouvelles
        await tx.title_recommendations.createMany({
          data: records,
          skipDuplicates: false,
        });
      });
    }

    totalInserted += records.length;
    console.log(
      `[batch ${i / batchSize + 1}] ${batch.length} titles processed, ${records.length} recs`,
    );
  }

  return totalInserted;
}

/**
 * Charge les crédits groupés par personne depuis la base de données
 *
 * @returns Map person_id -> { titles: Set<title_id>, genre: string | null }
 */
async function loadPersonData(): Promise<Map<string, PersonData>> {
  const credits = await prisma.credits.findMany({
    where: { episode_id: null },
    select: {
      person_id: true,
      title_id: true,
      people: { select: { genre: true } },
    },
  });

  const personData = new Map<string, PersonData>();
  for (const c of credits) {
    if (!personData.has(c.person_id)) {
      personData.set(c.person_id, {
        titles: new Set(),
        genre: c.people?.genre ?? null,
      });
    }
    personData.get(c.person_id)!.titles.add(c.title_id);
  }

  return personData;
}

/**
 * Calcule les recommandations de personnes similaires pour toutes les personnes
 *
 * @returns Nombre total de recommandations insérées
 */
export async function computePersonRecommendations(): Promise<number> {
  const personData = await loadPersonData();

  const personIds = Array.from(personData.keys());
  const records: PersonRecommendation[] = [];

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
      // Symétrique : si A recommande B, alors B recommande A
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

/**
 * Calcule toutes les recommandations (titres + personnes)
 *
 * @param batchSize - Taille du batch pour les titres
 * @returns Statistiques { titlesComputed: number, peopleComputed: number }
 */
export async function computeAllRecommendations(batchSize: number = 100): Promise<{
  titlesComputed: number;
  peopleComputed: number;
}> {
  console.log('Starting title recommendations computation...');
  const titlesComputed = await computeTitleRecommendations(batchSize);
  console.log(`Title recommendations: ${titlesComputed} inserted`);

  console.log('Starting person recommendations computation...');
  const peopleComputed = await computePersonRecommendations();
  console.log(`Person recommendations: ${peopleComputed} inserted`);

  return { titlesComputed, peopleComputed };
}

/**
 * Calcule les recommandations pour un seul titre (utile en dev)
 *
 * @param titleId - ID du titre à analyser
 * @returns Tableau des recommandations pour ce titre
 */
export async function computeRecommendationsForTitle(
  titleId: string,
): Promise<TitleRecommendation[]> {
  const titleGenres = await loadTitleGenres();
  const titleCredits = await loadTitleCredits();

  const allTitleIds = Array.from(titleGenres.keys());
  const candidates: Array<{ id: string; score: number }> = [];

  const genresA = titleGenres.get(titleId);
  const creditsA = titleCredits.get(titleId) ?? { actors: new Set(), directors: new Set() };

  if (!genresA) {
    console.warn(`Title ${titleId} not found in database`);
    return [];
  }

  for (const titleIdB of allTitleIds) {
    if (titleId === titleIdB) continue;

    const genresB = titleGenres.get(titleIdB)!;
    if (!hasCommonGenre(genresA, genresB)) continue;

    const creditsB = titleCredits.get(titleIdB) ?? { actors: new Set(), directors: new Set() };
    const score = computeTitleScore(
      genresA,
      genresB,
      creditsA.actors,
      creditsB.actors,
      creditsA.directors,
      creditsB.directors,
    );

    if (score > 0) {
      candidates.push({ id: titleIdB, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const top10 = candidates.slice(0, 10);

  return top10.map((c) => ({
    title_id: titleId,
    recommended_id: c.id,
    score: c.score,
  }));
}

export { jaccardSimilarity, hasCommonGenre };
