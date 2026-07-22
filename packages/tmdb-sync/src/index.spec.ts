import { jest } from '@jest/globals';

jest.unstable_mockModule('@emdb/tmdb-client', () => ({
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
}));

jest.unstable_mockModule('@emdb/tmdb-mapper', () => ({
  mapTmdbEpisodeCredits: jest.fn(),
  mapTmdbPersonExternalIds: jest.fn(),
  mapTmdbMovieToTitle: jest.fn(),
  mapTmdbTvToTitle: jest.fn(),
}));

jest.unstable_mockModule('@emdb/wikidata-client', () => ({
  getWikipediaUrlFromWikidataId: jest.fn(),
}));

const prismaMock = {
  people: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  titles: { findUnique: jest.fn(), upsert: jest.fn() },
  title_recommendations: { createMany: jest.fn() },
  seasons: { upsert: jest.fn() },
  episodes: { upsert: jest.fn() },
  roles: { upsert: jest.fn() },
  credits: { create: jest.fn() },
};

jest.unstable_mockModule('@emdb/db', () => ({
  prisma: prismaMock,
}));

const {
  importPersonByTmdbId,
  bootstrapRecommendationsFromTmdb,
} = await import('./index');

const {
  getPersonDetails,
  getPersonExternalIds,
  getMovieRecommendations,
  getMovieSimilar,
} = await import('@emdb/tmdb-client');

const { mapTmdbPersonExternalIds } = await import('@emdb/tmdb-mapper');
const { getWikipediaUrlFromWikidataId } = await import('@emdb/wikidata-client');

describe('tmdb-sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('importe une personne TMDB et résout le wiki via Wikidata', async () => {
    (getPersonDetails as jest.Mock).mockResolvedValue({
      id: 1,
      name: 'Jean Dupont',
      gender: 2,
      birthday: '1980-01-01',
      profile_path: '/photo.jpg',
      biography: 'Bio',
    });

    (getPersonExternalIds as jest.Mock).mockResolvedValue({ wikidata_id: 'Q1' });
    (mapTmdbPersonExternalIds as jest.Mock).mockImplementation((ids) => ids);
    (getWikipediaUrlFromWikidataId as jest.Mock).mockResolvedValue('https://fr.wikipedia.org/wiki/Jean_Dupont');
    (prismaMock.people.upsert as jest.Mock).mockResolvedValue({ id: 'person-uuid' });

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
    (prismaMock.titles.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'title-uuid', tmdb_id: 42, type: 'film' })
      .mockImplementation(({ where }: any) => {
        if (where?.tmdb_id === 10) return { id: 'rec-10', tmdb_id: 10 };
        if (where?.tmdb_id === 11) return { id: 'rec-11', tmdb_id: 11 };
        return null;
      });

    (getMovieRecommendations as jest.Mock).mockResolvedValue({ results: [{ id: 10, vote_average: 8.0 }] });
    (getMovieSimilar as jest.Mock).mockResolvedValue({ results: [{ id: 11, vote_average: 7.0 }] });
    (prismaMock.title_recommendations.createMany as jest.Mock).mockResolvedValue({ count: 2 });

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
});
