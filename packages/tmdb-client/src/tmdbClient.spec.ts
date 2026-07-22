import {
  getConfiguration,
  getTvEpisodeDetails,
  searchPerson,
  searchMulti,
  getTvExternalIds,
  getPersonExternalIds,
  getMovieRecommendations,
  getDiscoverMovie,
  getChanges,
  getTrending,
} from './tmdbClient';

describe('tmdbClient', () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TMDB_API_KEY;
  let fetchMock: jest.Mock;

  beforeAll(() => {
    process.env.TMDB_API_KEY = 'fake-api-key';
    fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        images: {
          base_url: 'http://image.tmdb.org/t/p/',
          secure_base_url: 'https://image.tmdb.org/t/p/',
          backdrop_sizes: ['w300', 'w780'],
          logo_sizes: ['w45', 'w92'],
          poster_sizes: ['w92', 'w154'],
          profile_sizes: ['w45', 'w185'],
          still_sizes: ['w92', 'w185'],
        },
      }),
    } as any));
    globalThis.fetch = fetchMock;
  });

  afterAll(() => {
    process.env.TMDB_API_KEY = originalApiKey;
    globalThis.fetch = originalFetch;
  });

  it('doit appeler l’API TMDB configuration et renvoyer le résultat', async () => {
    const result = await getConfiguration();

    expect(result.images.base_url).toBe('http://image.tmdb.org/t/p/');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/configuration'),
      expect.any(Object),
    );
  });

  it('doit appeler searchPerson avec le bon endpoint', async () => {
    await searchPerson('test');
    expect(fetchMock.mock.calls.some(
      ([url]) => (url as string).includes('/search/person?api_key=fake-api-key&query=test'),
    )).toBe(true);
  });

  it('doit appeler getTvEpisodeDetails avec credits', async () => {
    await getTvEpisodeDetails(123, 1, 2);
    expect(fetchMock.mock.calls.some(
      ([url]) => (url as string).includes('/tv/123/season/1/episode/2?api_key=fake-api-key&append_to_response=credits'),
    )).toBe(true);
  });

  it('doit appeler searchMulti avec le bon endpoint', async () => {
    await searchMulti('test');
    expect(fetchMock.mock.calls.some(
      ([url]) => (url as string).includes('/search/multi?api_key=fake-api-key&query=test'),
    )).toBe(true);
  });

  it('doit appeler getTvExternalIds et getPersonExternalIds', async () => {
    await getTvExternalIds(321);
    await getPersonExternalIds(654);
    expect(fetchMock.mock.calls.some(
      ([url]) => (url as string).includes('/tv/321/external_ids?api_key=fake-api-key'),
    )).toBe(true);
    expect(fetchMock.mock.calls.some(
      ([url]) => (url as string).includes('/person/654/external_ids?api_key=fake-api-key'),
    )).toBe(true);
  });

  it('doit appeler getMovieRecommendations et getDiscoverMovie', async () => {
    await getMovieRecommendations(111);
    await getDiscoverMovie({ with_genres: '28', year: 2023 });
    expect(fetchMock.mock.calls.some(
      ([url]) => (url as string).includes('/movie/111/recommendations?api_key=fake-api-key'),
    )).toBe(true);
    expect(fetchMock.mock.calls.some(
      ([url]) => (url as string).includes('/discover/movie?api_key=fake-api-key&with_genres=28&year=2023'),
    )).toBe(true);
  });

  it('doit appeler getChanges avec un intervalle de dates', async () => {
    await getChanges('2024-01-01', '2024-01-31');
    expect(fetchMock.mock.calls.some(
      ([url]) => (url as string).includes('/movie/changes?api_key=fake-api-key&start_date=2024-01-01&end_date=2024-01-31'),
    )).toBe(true);
  });

  it('doit appeler getTrending avec mediaType et timeWindow', async () => {
    await getTrending('tv', 'week');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/trending/tv/week'),
      expect.any(Object),
    );
  });
});
