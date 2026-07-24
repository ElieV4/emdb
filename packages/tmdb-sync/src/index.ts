import { prisma } from '@emdb/db';
import {
  getMovieDetails,
  getTvDetails,
  getPersonDetails,
  getTvSeason,
  getPersonExternalIds,
  getMovieRecommendations,
  getMovieSimilar,
  getTvRecommendations,
  getTvSimilar,
  getTvEpisodeDetails,
  getChanges,
  getPersonCombinedCredits,
} from '@emdb/tmdb-client';
import {
  mapTmdbEpisodeCredits,
  mapTmdbPersonExternalIds,
  mapTmdbMovieToTitle,
  mapTmdbTvToTitle,
  mapTmdbGenres,
  mapTmdbCountries,
  mapTmdbCredits,
  mapTmdbSeason,
  mapTmdbEpisode,
  mapTmdbPerson,
} from '@emdb/tmdb-mapper';
import { getWikipediaUrlFromWikidataId } from '@emdb/wikidata-client';

const ROLE_LIBELLES: Record<string, string> = {
  acteur: 'Acteur',
  realisateur: 'Réalisateur',
  scenariste: 'Scénariste',
  autre: 'Autre',
};

async function ensureRoleId(role: 'acteur' | 'realisateur' | 'scenariste' | 'autre') {
  const code = role;
  const libelle = ROLE_LIBELLES[role] ?? 'Autre';

  const roleRecord = await prisma.roles.upsert({
    where: { code },
    update: { libelle },
    create: { code, libelle },
  });

  return roleRecord.id;
}

type SyncAction = 'importTitle' | 'importPerson' | 'dailySyncNewEpisodes' | 'weeklyResyncChanges';

async function createSyncLog(params: {
  tmdb_id: number;
  type: string;
  action: SyncAction;
  status: 'started' | 'success' | 'failed';
  error?: string | null;
}) {
  await prisma.tmdb_sync_log.create({
    data: {
      tmdb_id: params.tmdb_id,
      type: params.type,
      action: params.action,
      status: params.status,
      error: params.error ?? null,
    },
  });
}

export async function importPersonByTmdbId(tmdbId: number) {
  const tmdbPerson = await getPersonDetails(tmdbId);
  const externalIds = await getPersonExternalIds(tmdbId);
  const { wikidata_id } = mapTmdbPersonExternalIds(externalIds);
  const wikiUrl = wikidata_id ? await getWikipediaUrlFromWikidataId(wikidata_id) : null;

  const mappedPerson = mapTmdbPerson(tmdbPerson, wikiUrl);

  const person = await prisma.people.upsert({
    where: { tmdb_id: tmdbId },
    update: mappedPerson,
    create: mappedPerson,
  });

  return person;
}

export async function importEpisodeGuestCredits(
  episodeId: string,
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  const episodeDetails = await getTvEpisodeDetails(tmdbId, seasonNumber, episodeNumber);
  const credits = mapTmdbEpisodeCredits(episodeDetails, episodeId);

  const title = await prisma.titles.findUnique({
    where: { tmdb_id: episodeDetails.show.id },
  });

  if (!title) {
    throw new Error('Titre local introuvable pour le show TMDB');
  }

  for (const credit of credits) {
    const person = await importPersonByTmdbId(credit.tmdb_person_id);
    const roleId = await ensureRoleId(credit.role);

    try {
      await prisma.credits.create({
        data: {
          title_id: title.id,
          person_id: person.id,
          episode_id: episodeId,
          role_id: roleId,
          personnage: credit.personnage ?? null,
          ordre: credit.ordre ?? 0,
          source: 'tmdb',
        },
      });
    } catch (error: any) {
      if (/duplicate key/i.test(error.message) || /unique constraint/.test(error.message)) {
        continue;
      }
      throw error;
    }
  }
}

async function ensureGenreIds(genres: { id: number; name: string }[]) {
  const ids: string[] = [];

  for (const genre of mapTmdbGenres(genres)) {
    const record = await prisma.genres.upsert({
      where: { tmdb_id: genre.tmdb_id },
      create: {
        tmdb_id: genre.tmdb_id,
        nom: genre.nom,
      },
      update: {
        nom: genre.nom,
      },
    });
    ids.push(record.id);
  }

  return ids;
}

async function ensureCountryIds(countries: { iso_3166_1: string; name: string }[]) {
  const ids: string[] = [];

  for (const country of mapTmdbCountries(countries)) {
    const record = await prisma.countries.upsert({
      where: { code: country.code },
      create: {
        code: country.code,
        nom: country.nom,
      },
      update: {
        nom: country.nom,
      },
    });
    ids.push(record.id);
  }

  return ids;
}

export async function importTitleByTmdbId(tmdbId: number, type: 'film' | 'serie') {
  await createSyncLog({
    tmdb_id: tmdbId,
    type,
    action: 'importTitle',
    status: 'started',
  });

  try {
    const tmdbData = type === 'film' ? await getMovieDetails(tmdbId) : await getTvDetails(tmdbId);
    const titlePayload =
      type === 'film' ? mapTmdbMovieToTitle(tmdbData) : mapTmdbTvToTitle(tmdbData);

    const title = await prisma.titles.upsert({
      where: { tmdb_id: tmdbId },
      create: titlePayload,
      update: titlePayload,
    });

    if (tmdbData.genres?.length) {
      const genreIds = await ensureGenreIds(tmdbData.genres);
      await prisma.title_genres.createMany({
        data: genreIds.map((genreId) => ({ title_id: title.id, genre_id: genreId })),
        skipDuplicates: true,
      });
    }

    if (tmdbData.production_countries?.length) {
      const countryIds = await ensureCountryIds(tmdbData.production_countries);
      await prisma.title_countries.createMany({
        data: countryIds.map((countryId) => ({ title_id: title.id, country_id: countryId })),
        skipDuplicates: true,
      });
    }

    if (tmdbData.credits) {
      const creditInserts = mapTmdbCredits(tmdbData.credits, title.id, null);
      for (const credit of creditInserts) {
        const person = await importPersonByTmdbId(credit.tmdb_person_id);
        const roleId = await ensureRoleId(credit.role);
        try {
          await prisma.credits.create({
            data: {
              title_id: title.id,
              person_id: person.id,
              episode_id: null,
              role_id: roleId,
              personnage: credit.personnage,
              ordre: credit.ordre,
              source: 'tmdb',
            },
          });
        } catch (error: any) {
          if (/duplicate key/i.test(error.message) || /unique constraint/.test(error.message)) {
            continue;
          }
          throw error;
        }
      }
    }

    if (type === 'serie') {
      await importSeasonsForSerie(title.id);
    }

    await createSyncLog({
      tmdb_id: tmdbId,
      type,
      action: 'importTitle',
      status: 'success',
    });

    return title;
  } catch (error: any) {
    await createSyncLog({
      tmdb_id: tmdbId,
      type,
      action: 'importTitle',
      status: 'failed',
      error: error?.message ?? 'unknown error',
    });
    throw error;
  }
}

export async function importSeasonsForSerie(titleId: string) {
  const title = await prisma.titles.findUnique({ where: { id: titleId } });
  if (!title?.tmdb_id || title.type !== 'serie') {
    throw new Error('Titre introuvable, non-série ou sans tmdb_id');
  }

  const tvDetails = await getTvDetails(title.tmdb_id);
  const seasons = tvDetails.seasons || [];

  for (const seasonSummary of seasons) {
    const seasonDetails = await getTvSeason(title.tmdb_id, seasonSummary.season_number);
    const seasonPayload = mapTmdbSeason(seasonDetails, titleId);

    const season = await prisma.seasons.upsert({
      where: {
        title_id_numero: {
          title_id: titleId,
          numero: seasonDetails.season_number,
        },
      },
      create: seasonPayload,
      update: seasonPayload,
    });

    for (const episode of seasonDetails.episodes || []) {
      const episodePayload = mapTmdbEpisode(episode, season.id);
      await prisma.episodes.upsert({
        where: {
          season_id_numero: {
            season_id: season.id,
            numero: episode.episode_number,
          },
        },
        create: episodePayload,
        update: episodePayload,
      });
    }
  }
}

export async function refreshPersonData(personId: string) {
  const person = await prisma.people.findUnique({ where: { id: personId } });
  if (!person?.tmdb_id) {
    throw new Error('Personne introuvable ou sans tmdb_id');
  }

  const tmdbPerson = await getPersonDetails(person.tmdb_id);
  const externalIds = await getPersonExternalIds(person.tmdb_id);
  const { wikidata_id } = mapTmdbPersonExternalIds(externalIds);
  const wikiUrl = wikidata_id ? await getWikipediaUrlFromWikidataId(wikidata_id) : null;

  return prisma.people.update({
    where: { id: personId },
    data: {
      nom: tmdbPerson.name,
      genre: tmdbPerson.gender === 1 ? 'femme' : tmdbPerson.gender === 2 ? 'homme' : 'autre',
      date_naissance: tmdbPerson.birthday ? new Date(tmdbPerson.birthday) : null,
      photo_url: tmdbPerson.profile_path
        ? `https://image.tmdb.org/t/p/w500${tmdbPerson.profile_path}`
        : null,
      bio: tmdbPerson.biography,
      wiki_url: wikiUrl,
    },
  });
}

export async function refreshTitleData(titleId: string) {
  const title = await prisma.titles.findUnique({ where: { id: titleId } });
  if (!title?.tmdb_id) {
    throw new Error('Titre introuvable ou sans tmdb_id');
  }

  const tmdbData =
    title.type === 'film'
      ? await getMovieDetails(title.tmdb_id)
      : await getTvDetails(title.tmdb_id);

  const updatePayload =
    title.type === 'film' ? mapTmdbMovieToTitle(tmdbData) : mapTmdbTvToTitle(tmdbData);

  return prisma.titles.update({
    where: { id: titleId },
    data: updatePayload,
  });
}

/**
 * Génère des notifications pour les nouveaux épisodes des séries suivies.
 *
 * Algorithme :
 * 1. Récupérer toutes les séries en cours avec next_episode_air_date <= aujourd'hui
 * 2. Pour chaque série, trouver les utilisateurs qui la suivent
 * 3. Trouver le dernier épisode sorti non encore notifié
 * 4. Créer une notification par follower (déduplication par episode_id + type)
 *
 * @returns Nombre total de notifications créées
 * @phase 7.2
 */
export async function generateNewEpisodeNotifications(): Promise<number> {
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
    const followers = await prisma.user_follows_serie.findMany({
      where: { title_id: serie.id },
      select: { user_id: true },
    });

    if (followers.length === 0) continue;

    const latestEpisode = await prisma.episodes.findFirst({
      where: {
        seasons: { title_id: serie.id },
        date_sortie: { lte: new Date() },
      },
      orderBy: { date_sortie: 'desc' },
      select: { id: true, numero: true, titre: true },
    });

    if (!latestEpisode) continue;

    const existingNotif = await prisma.notifications.findFirst({
      where: {
        episode_id: latestEpisode.id,
        type: 'new_episode',
      },
    });

    if (existingNotif) continue;

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

/**
 * Génère une notification pour la première d'une nouvelle saison.
 *
 * Déclenché quand une nouvelle saison est importée pour une série suivie.
 *
 * @param titleId - UUID de la série
 * @param seasonNumber - Numéro de la nouvelle saison
 * @returns Nombre de notifications créées
 * @phase 7.2
 */
export async function generateSeasonPremiereNotification(
  titleId: string,
  seasonNumber: number,
): Promise<number> {
  const followers = await prisma.user_follows_serie.findMany({
    where: { title_id: titleId },
    select: { user_id: true },
  });

  if (followers.length === 0) return 0;

  const firstEpisode = await prisma.episodes.findFirst({
    where: {
      seasons: { title_id: titleId, numero: seasonNumber },
    },
    orderBy: { numero: 'asc' },
    select: { id: true },
  });

  if (!firstEpisode) return 0;

  const existingNotif = await prisma.notifications.findFirst({
    where: {
      episode_id: firstEpisode.id,
      type: 'season_premiere',
    },
  });

  if (existingNotif) return 0;

  const notifications = followers.map((f) => ({
    user_id: f.user_id,
    episode_id: firstEpisode.id,
    type: 'season_premiere',
    lu: false,
  }));

  await prisma.notifications.createMany({ data: notifications });
  return notifications.length;
}

export async function dailySyncNewEpisodes() {
  const titles = await prisma.titles.findMany({
    where: {
      type: 'serie',
      statut_serie: 'en_cours',
      OR: [
        { user_follows_serie: { some: {} } },
        { user_ratings: { some: {} } },
        { user_watches: { some: {} } },
      ],
    },
    select: {
      id: true,
      tmdb_id: true,
    },
  });

  let titlesRefreshed = 0;

  for (const title of titles) {
    if (!title.tmdb_id) {
      continue;
    }

    await refreshTitleData(title.id);
    await importSeasonsForSerie(title.id);
    titlesRefreshed++;
  }

  // Générer les notifications pour les nouveaux épisodes (Phase 7.2)
  const notificationsCreated = await generateNewEpisodeNotifications();

  return { titlesRefreshed, notificationsCreated };
}

export async function weeklyResyncChanges(startDate: string, endDate: string) {
  const changes = await getChanges(startDate, endDate);
  const updatedTitles: Array<{ tmdbId: number; type: 'film' | 'serie' }> = [];

  for (const movieChange of changes.movie?.results || []) {
    const title = await prisma.titles.findUnique({
      where: { tmdb_id: movieChange.id },
    });

    if (!title || title.type !== 'film') {
      continue;
    }

    await importTitleByTmdbId(movieChange.id, 'film');
    updatedTitles.push({ tmdbId: movieChange.id, type: 'film' });
  }

  for (const tvChange of changes.tv?.results || []) {
    const title = await prisma.titles.findUnique({
      where: { tmdb_id: tvChange.id },
    });

    if (!title || title.type !== 'serie') {
      continue;
    }

    await importTitleByTmdbId(tvChange.id, 'serie');
    updatedTitles.push({ tmdbId: tvChange.id, type: 'serie' });
  }

  return updatedTitles;
}

const TMDB_RECOMMENDATION_LIMIT = 10;

/**
 * Bootstrap les recommandations TMDB pour une personne.
 *
 * Stratégie :
 * 1. Fetch getPersonCombinedCredits(personTmdbId) → tous les titres TMDB de cette personne
 * 2. Filtrer les titres déjà présents en local (prisma.titles.findMany)
 * 3. Pour chaque titre local, trouver les autres personnes (credits) qui y ont participé
 * 4. Calculer le score de similarité : Jaccard = intersection / union des credits
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
    throw new Error("La personne n'a pas de tmdb_id, impossible de bootstrap depuis TMDB.");
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

export async function bootstrapRecommendationsFromTmdb(titleId: string) {
  const title = await prisma.titles.findUnique({ where: { id: titleId } });
  if (!title?.tmdb_id) {
    throw new Error('Titre introuvable ou sans tmdb_id');
  }

  const tmdbId = title.tmdb_id;
  const recommendationFetcher =
    title.type === 'film'
      ? () => Promise.all([getMovieRecommendations(tmdbId), getMovieSimilar(tmdbId)])
      : () => Promise.all([getTvRecommendations(tmdbId), getTvSimilar(tmdbId)]);

  const [recommendations, similar] = await recommendationFetcher();

  const records = [] as Array<{ title_id: string; recommended_id: string; score: number }>;

  for (const rec of [...recommendations.results, ...similar.results]) {
    if (!rec.id) continue;
    const existingTitle = await prisma.titles.findUnique({ where: { tmdb_id: rec.id } });
    if (!existingTitle) continue;
    records.push({
      title_id: titleId,
      recommended_id: existingTitle.id,
      score: rec.vote_average ? Number(rec.vote_average) / 10 : 0,
    });
  }

  if (records.length > 0) {
    await prisma.title_recommendations.createMany({ data: records, skipDuplicates: true });
  }

  return records;
}
