import { jest } from '@jest/globals';

const prismaMock: any = {
  people: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  titles: { findUnique: jest.fn(), upsert: jest.fn(), findMany: jest.fn() },
  title_recommendations: { createMany: jest.fn() },
  seasons: { upsert: jest.fn() },
  episodes: { upsert: jest.fn() },
  roles: { upsert: jest.fn() },
  credits: { create: jest.fn(), findMany: jest.fn() },
  genres: { upsert: jest.fn() },
  countries: { upsert: jest.fn() },
  title_genres: { createMany: jest.fn() },
  title_countries: { createMany: jest.fn() },
  tmdb_sync_log: { create: jest.fn() },
  person_recommendations: { deleteMany: jest.fn(), createMany: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('@emdb/tmdb-client', () => ({
  getMovieDetails: jest.fn(),
  getTvDetails: jest.fn(),
  getPersonDetails: jest.fn(),
  getTvSeason: jest.fn(),
  getPersonExternalIds: jest.fn(),
  getTvEpisodeDetails: jest.fn(),
  getMovieRecommendations: jest.fn(),
  getMovieSimilar: jest.fn(),
  getTvRecommendations: jest.fn(),
  getTvSimilar: jest.fn(),
  getPersonCombinedCredits: jest.fn(),
}));

jest.mock('@emdb/tmdb-mapper', () => ({
  mapTmdbEpisodeCredits: jest.fn(),
  mapTmdbPersonExternalIds: jest.fn(),
  mapTmdbMovieToTitle: jest.fn(),
  mapTmdbTvToTitle: jest.fn(),
  mapTmdbPerson: jest.fn(),
  mapTmdbGenres: jest.fn(),
  mapTmdbCountries: jest.fn(),
  mapTmdbCredits: jest.fn(),
  mapTmdbSeason: jest.fn(),
  mapTmdbEpisode: jest.fn(),
}));

jest.mock('@emdb/wikidata-client', () => ({
  getWikipediaUrlFromWikidataId: jest.fn(),
}));

jest.mock('@emdb/db', () => ({
  prisma: prismaMock,
}));

const asMock = (fn: any) => fn as any;

const {
  importPersonByTmdbId,
  bootstrapRecommendationsFromTmdb,
  bootstrapPersonRecommendationsFromTmdb,
  importTitleByTmdbId,
  importSeasonsForSerie,
} = require('./index');

const tmdbClient = require('@emdb/tmdb-client') as any;
const {
  getPersonDetails,
  getPersonExternalIds,
  getMovieDetails,
  getTvDetails,
  getTvSeason,
  getMovieRecommendations,
  getMovieSimilar,
  getPersonCombinedCredits,
} = tmdbClient;

const tmdbMapper = require('@emdb/tmdb-mapper') as any;
const {
  mapTmdbPersonExternalIds,
  mapTmdbPerson,
  mapTmdbMovieToTitle,
  mapTmdbGenres,
  mapTmdbCountries,
  mapTmdbCredits,
  mapTmdbSeason,
  mapTmdbEpisode,
} = tmdbMapper;
const wikidataClient = require('@emdb/wikidata-client') as any;
const { getWikipediaUrlFromWikidataId } = wikidataClient;

describe('tmdb-sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('importe une personne TMDB et résout le wiki via Wikidata', async () => {
    asMock(getPersonDetails).mockResolvedValue({
      id: 1,
      name: 'Jean Dupont',
      gender: 2,
      birthday: '1980-01-01',
      profile_path: '/photo.jpg',
      biography: 'Bio',
    });

    asMock(getPersonExternalIds).mockResolvedValue({ wikidata_id: 'Q1' });
    asMock(mapTmdbPersonExternalIds).mockImplementation((ids: any) => ids);
    asMock(mapTmdbPerson).mockImplementation((person: any, wikiUrl: string | null) => ({
      tmdb_id: person.id,
      nom: person.name,
      wiki_url: wikiUrl,
    }));
    asMock(getWikipediaUrlFromWikidataId).mockResolvedValue('https://fr.wikipedia.org/wiki/Jean_Dupont');
    asMock(prismaMock.people.upsert).mockResolvedValue({ id: 'person-uuid' });

    const person = await importPersonByTmdbId(1);

    expect(person).toEqual({ id: 'person-uuid' });
    expect(prismaMock.people.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tmdb_id: 1 },
      create: expect.objectContaining({
        tmdb_id: 1,
        nom: 'Jean Dupont',
      }),
    }));
  });

  it('bootstrapRecommendationsFromTmdb créé des recommandations existantes', async () => {
    asMock(prismaMock.titles.findUnique)
      .mockResolvedValueOnce({ id: 'title-uuid', tmdb_id: 42, type: 'film' })
      .mockImplementation(({ where }: any) => {
        if (where?.tmdb_id === 10) return { id: 'rec-10', tmdb_id: 10 };
        if (where?.tmdb_id === 11) return { id: 'rec-11', tmdb_id: 11 };
        return null;
      });

    asMock(getMovieRecommendations).mockResolvedValue({ results: [{ id: 10, vote_average: 8.0 }] });
    asMock(getMovieSimilar).mockResolvedValue({ results: [{ id: 11, vote_average: 7.0 }] });
    asMock(prismaMock.title_recommendations.createMany).mockResolvedValue({ count: 2 });

    const records = await bootstrapRecommendationsFromTmdb('title-uuid');

    expect(records).toEqual([
      { title_id: 'title-uuid', recommended_id: 'rec-10', score: 0.8 },
      { title_id: 'title-uuid', recommended_id: 'rec-11', score: 0.7 },
    ]);

    expect(prismaMock.title_recommendations.createMany).toHaveBeenCalledWith({
      data: records,
      skipDuplicates: true,
    });
  });

  it('importe un film TMDB en titre et crée ses crédits', async () => {
    asMock(getMovieDetails).mockResolvedValue({
      id: 99,
      title: 'Film TMDB',
      original_title: 'Original Film',
      overview: 'Résumé',
      release_date: '2025-01-01',
      runtime: 100,
      vote_average: 7.8,
      poster_path: '/poster.jpg',
      genres: [{ id: 1, name: 'Action' }],
      production_countries: [{ iso_3166_1: 'US', name: 'United States' }],
      credits: {
        cast: [{ id: 22, name: 'Acteur', character: 'Personnage', order: 1 }],
        crew: [{ id: 23, name: 'Réalisateur', job: 'Director' }],
      },
    });
    asMock(mapTmdbMovieToTitle).mockImplementation((movie: any) => ({
      tmdb_id: movie.id,
      titre: movie.title,
      original_title: movie.original_title,
      resume: movie.overview,
      date_sortie: new Date(movie.release_date),
      duree: movie.runtime,
      vote_moyen: movie.vote_average,
      poster_url: movie.poster_path,
    }));
    asMock(mapTmdbGenres).mockImplementation((genres: any) => genres.map((genre: any) => ({ tmdb_id: genre.id, nom: genre.name })));
    asMock(mapTmdbCountries).mockImplementation((countries: any) => countries.map((country: any) => ({ code: country.iso_3166_1, nom: country.name })));
    asMock(mapTmdbCredits).mockImplementation((credits: any) => [
      {
        tmdb_person_id: credits.cast[0].id,
        role: 'acteur',
        personnage: credits.cast[0].character,
        ordre: credits.cast[0].order,
      },
    ]);

    asMock(prismaMock.titles.upsert).mockResolvedValue({ id: 'new-title-uuid' });
    asMock(prismaMock.genres.upsert).mockResolvedValue({ id: 'genre-uuid' });
    asMock(prismaMock.countries.upsert).mockResolvedValue({ id: 'country-uuid' });
    asMock(prismaMock.people.upsert).mockResolvedValue({ id: 'person-uuid' });
    asMock(prismaMock.roles.upsert).mockResolvedValue({ id: 'role-uuid' });
    asMock(prismaMock.credits.create).mockResolvedValue({});
    asMock(prismaMock.title_genres.createMany).mockResolvedValue({ count: 1 });
    asMock(prismaMock.title_countries.createMany).mockResolvedValue({ count: 1 });

    const title = await importTitleByTmdbId(99, 'film');

    expect(title).toEqual({ id: 'new-title-uuid' });
    expect(prismaMock.genres.upsert).toHaveBeenCalled();
    expect(prismaMock.title_genres.createMany).toHaveBeenCalled();
    expect(prismaMock.countries.upsert).toHaveBeenCalled();
    expect(prismaMock.title_countries.createMany).toHaveBeenCalled();
    expect(prismaMock.credits.create).toHaveBeenCalledTimes(1);
  });

  it('importe une série TMDB et crée les saisons/épisodes', async () => {
    asMock(prismaMock.titles.findUnique).mockResolvedValue({ id: 'serie-uuid', tmdb_id: 123, type: 'serie' });
    asMock(getTvDetails).mockResolvedValue({ seasons: [{ season_number: 1 }] });
    asMock(getTvSeason).mockResolvedValue({
      season_number: 1,
      name: 'Saison 1',
      air_date: '2025-02-01',
      overview: 'Saison 1 description',
      episodes: [
        {
          episode_number: 1,
          name: 'Episode 1',
          overview: 'Épisode 1',
          air_date: '2025-02-08',
          runtime: 45,
          still_path: '/still.jpg',
        },
      ],
    });
    asMock(mapTmdbSeason).mockImplementation((seasonDetails: any, titleId: string) => ({
      title_id: titleId,
      numero: seasonDetails.season_number,
      nom: seasonDetails.name,
      date_premiere: new Date(seasonDetails.air_date),
      resume: seasonDetails.overview,
    }));
    asMock(mapTmdbEpisode).mockImplementation((episode: any, seasonId: string) => ({
      season_id: seasonId,
      numero: episode.episode_number,
      titre: episode.name,
      resume: episode.overview,
      date_diffusion: new Date(episode.air_date),
      duree: episode.runtime,
      image_url: episode.still_path,
    }));

    asMock(prismaMock.seasons.upsert).mockResolvedValue({ id: 'season-uuid' });
    asMock(prismaMock.episodes.upsert).mockResolvedValue({});

    await importSeasonsForSerie('serie-uuid');

    expect(prismaMock.seasons.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        title_id: 'serie-uuid',
        numero: 1,
      }),
    }));
    expect(prismaMock.episodes.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        season_id: 'season-uuid',
        numero: 1,
      }),
    }));
  });

  describe('bootstrapPersonRecommendationsFromTmdb', () => {
    it('appelle getPersonCombinedCredits et insère des recommandations', async () => {
      asMock(prismaMock.people.findUnique).mockResolvedValue({ id: 'person-uuid', tmdb_id: 42 });
      asMock(getPersonCombinedCredits).mockResolvedValue({
        cast: [{ id: 100 }, { id: 101 }],
        crew: [{ id: 102 }],
      });
      asMock(prismaMock.titles.findMany).mockResolvedValue([
        { id: 'title-1' },
        { id: 'title-2' },
        { id: 'title-3' },
      ]);
      asMock(prismaMock.credits.findMany).mockResolvedValue([
        { person_id: 'other-1', title_id: 'title-1' },
        { person_id: 'other-1', title_id: 'title-2' },
        { person_id: 'other-2', title_id: 'title-1' },
        { person_id: 'other-3', title_id: 'title-3' },
      ]);

      // Mock $transaction to execute the callback
      asMock(prismaMock.$transaction).mockImplementation(async (cb: any) => {
        const tx = {
          person_recommendations: {
            deleteMany: prismaMock.person_recommendations.deleteMany,
            createMany: prismaMock.person_recommendations.createMany,
          },
        };
        return cb(tx);
      });

      const result = await bootstrapPersonRecommendationsFromTmdb('person-uuid');

      expect(result).toBeGreaterThan(0);
      expect(getPersonCombinedCredits).toHaveBeenCalledWith(42);
      expect(prismaMock.person_recommendations.deleteMany).toHaveBeenCalledWith({
        where: { person_id: 'person-uuid' },
      });
      expect(prismaMock.person_recommendations.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ person_id: 'person-uuid' }),
        ]),
      });
    });

    it('retourne 0 si la personne n\'a pas de tmdb_id', async () => {
      asMock(prismaMock.people.findUnique).mockResolvedValue({ id: 'person-uuid', tmdb_id: null });

      await expect(bootstrapPersonRecommendationsFromTmdb('person-uuid')).rejects.toThrow(
        "La personne n'a pas de tmdb_id",
      );
    });

    it('retourne 0 si aucun titre local trouvé', async () => {
      asMock(prismaMock.people.findUnique).mockResolvedValue({ id: 'person-uuid', tmdb_id: 42 });
      asMock(getPersonCombinedCredits).mockResolvedValue({
        cast: [{ id: 100 }],
        crew: [],
      });
      asMock(prismaMock.titles.findMany).mockResolvedValue([]); // Aucun titre local

      const result = await bootstrapPersonRecommendationsFromTmdb('person-uuid');

      expect(result).toBe(0);
    });

    it('limite à 10 recommandations max', async () => {
      asMock(prismaMock.people.findUnique).mockResolvedValue({ id: 'person-uuid', tmdb_id: 42 });
      asMock(getPersonCombinedCredits).mockResolvedValue({
        cast: [{ id: 1 }, { id: 2 }],
        crew: [],
      });
      asMock(prismaMock.titles.findMany).mockResolvedValue([{ id: 'title-1' }, { id: 'title-2' }]);

      // 15 autres personnes ayant travaillé sur ces titres
      const manyCredits = Array.from({ length: 15 }, (_, i) => ({
        person_id: `other-${i}`,
        title_id: 'title-1',
      }));
      asMock(prismaMock.credits.findMany).mockResolvedValue(manyCredits);

      asMock(prismaMock.$transaction).mockImplementation(async (cb: any) => {
        const tx = {
          person_recommendations: {
            deleteMany: prismaMock.person_recommendations.deleteMany,
            createMany: prismaMock.person_recommendations.createMany,
          },
        };
        return cb(tx);
      });

      const result = await bootstrapPersonRecommendationsFromTmdb('person-uuid');

      expect(result).toBeLessThanOrEqual(10);
    });

    it('lève Error si personne introuvable', async () => {
      asMock(prismaMock.people.findUnique).mockResolvedValue(null);

      await expect(bootstrapPersonRecommendationsFromTmdb('nonexistent')).rejects.toThrow(
        'Personne introuvable.',
      );
    });

    it('retourne 0 si aucun credit TMDB', async () => {
      asMock(prismaMock.people.findUnique).mockResolvedValue({ id: 'person-uuid', tmdb_id: 42 });
      asMock(getPersonCombinedCredits).mockResolvedValue({ cast: [], crew: [] });

      const result = await bootstrapPersonRecommendationsFromTmdb('person-uuid');

      expect(result).toBe(0);
    });
  });
});