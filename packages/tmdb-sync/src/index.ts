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
} from '@emdb/tmdb-client';
import {
  mapTmdbEpisodeCredits,
  mapTmdbPersonExternalIds,
  mapTmdbMovieToTitle,
  mapTmdbTvToTitle,
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

export async function importPersonByTmdbId(tmdbId: number) {
  const tmdbPerson = await getPersonDetails(tmdbId);
  const externalIds = await getPersonExternalIds(tmdbId);
  const { wikidata_id } = mapTmdbPersonExternalIds(externalIds);
  const wikiUrl = wikidata_id
    ? await getWikipediaUrlFromWikidataId(wikidata_id)
    : null;

  const person = await prisma.people.upsert({
    where: { tmdb_id: tmdbId },
    update: {
      nom: tmdbPerson.name,
      genre: tmdbPerson.gender === 1 ? 'femme' : tmdbPerson.gender === 2 ? 'homme' : 'autre',
      date_naissance: tmdbPerson.birthday ? new Date(tmdbPerson.birthday) : null,
      pays_id: null,
      photo_url: tmdbPerson.profile_path ? `https://image.tmdb.org/t/p/w500${tmdbPerson.profile_path}` : null,
      bio: tmdbPerson.biography,
      wiki_url: wikiUrl,
    },
    create: {
      tmdb_id: tmdbId,
      nom: tmdbPerson.name,
      genre: tmdbPerson.gender === 1 ? 'femme' : tmdbPerson.gender === 2 ? 'homme' : 'autre',
      date_naissance: tmdbPerson.birthday ? new Date(tmdbPerson.birthday) : null,
      pays_id: null,
      photo_url: tmdbPerson.profile_path ? `https://image.tmdb.org/t/p/w500${tmdbPerson.profile_path}` : null,
      bio: tmdbPerson.biography,
      wiki_url: wikiUrl,
    },
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

export async function importTitleByTmdbId(
  tmdbId: number,
  type: 'film' | 'serie',
) {
  const tmdbData = type === 'film' ? await getMovieDetails(tmdbId) : await getTvDetails(tmdbId);
  const titlePayload =
    type === 'film' ? mapTmdbMovieToTitle(tmdbData) : mapTmdbTvToTitle(tmdbData);

  return prisma.titles.upsert({
    where: { tmdb_id: tmdbId },
    create: titlePayload,
    update: titlePayload,
  });
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

    const season = await prisma.seasons.upsert({
      where: {
        title_id_numero: {
          title_id: titleId,
          numero: seasonDetails.season_number,
        },
      },
      create: {
        title_id: titleId,
        numero: seasonDetails.season_number,
        titre: seasonDetails.name ?? null,
        date_sortie: seasonDetails.air_date ? new Date(seasonDetails.air_date) : null,
        synopsis: seasonDetails.overview ?? null,
      },
      update: {
        titre: seasonDetails.name ?? null,
        date_sortie: seasonDetails.air_date ? new Date(seasonDetails.air_date) : null,
        synopsis: seasonDetails.overview ?? null,
      },
    });

    for (const episode of seasonDetails.episodes || []) {
      await prisma.episodes.upsert({
        where: {
          season_id_numero: {
            season_id: season.id,
            numero: episode.episode_number,
          },
        },
        create: {
          season_id: season.id,
          numero: episode.episode_number,
          titre: episode.name ?? null,
          synopsis: episode.overview ?? null,
          date_sortie: episode.air_date ? new Date(episode.air_date) : null,
          duree_minutes: episode.runtime ?? null,
          image_url: episode.still_path ? `https://image.tmdb.org/t/p/w500${episode.still_path}` : null,
        },
        update: {
          titre: episode.name ?? null,
          synopsis: episode.overview ?? null,
          date_sortie: episode.air_date ? new Date(episode.air_date) : null,
          duree_minutes: episode.runtime ?? null,
          image_url: episode.still_path ? `https://image.tmdb.org/t/p/w500${episode.still_path}` : null,
        },
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
  const wikiUrl = wikidata_id
    ? await getWikipediaUrlFromWikidataId(wikidata_id)
    : null;

  return prisma.people.update({
    where: { id: personId },
    data: {
      nom: tmdbPerson.name,
      genre: tmdbPerson.gender === 1 ? 'femme' : tmdbPerson.gender === 2 ? 'homme' : 'autre',
      date_naissance: tmdbPerson.birthday ? new Date(tmdbPerson.birthday) : null,
      photo_url: tmdbPerson.profile_path ? `https://image.tmdb.org/t/p/w500${tmdbPerson.profile_path}` : null,
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

  const tmdbData = title.type === 'film'
    ? await getMovieDetails(title.tmdb_id)
    : await getTvDetails(title.tmdb_id);

  const updatePayload = title.type === 'film'
    ? mapTmdbMovieToTitle(tmdbData)
    : mapTmdbTvToTitle(tmdbData);

  return prisma.titles.update({
    where: { id: titleId },
    data: updatePayload,
  });
}

export async function bootstrapRecommendationsFromTmdb(titleId: string) {
  const title = await prisma.titles.findUnique({ where: { id: titleId } });
  if (!title?.tmdb_id) {
    throw new Error('Titre introuvable ou sans tmdb_id');
  }

  const recommendationFetcher =
    title.type === 'film'
      ? () => Promise.all([getMovieRecommendations(title.tmdb_id), getMovieSimilar(title.tmdb_id)])
      : () => Promise.all([getTvRecommendations(title.tmdb_id), getTvSimilar(title.tmdb_id)]);

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
