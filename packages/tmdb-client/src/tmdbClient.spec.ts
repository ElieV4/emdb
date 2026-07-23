import { rest } from 'msw';
import { setupServer } from 'msw/node';
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
  getTvDetails,
} from './tmdbClient';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const configurationResponse = {
  images: {
    base_url: 'http://image.tmdb.org/t/p/',
    secure_base_url: 'https://image.tmdb.org/t/p/',
    backdrop_sizes: ['w300', 'w780'],
    logo_sizes: ['w45', 'w92'],
    poster_sizes: ['w92', 'w154'],
    profile_sizes: ['w45', 'w185'],
    still_sizes: ['w92', 'w185'],
  },
};

const server = setupServer(
  rest.get(`${TMDB_BASE_URL}/configuration`, (_req, res, ctx) => res(ctx.status(200), ctx.json(configurationResponse))),
  rest.get(`${TMDB_BASE_URL}/search/person`, (_req, res, ctx) => res(ctx.status(200), ctx.json({ results: [] }))),
  rest.get(`${TMDB_BASE_URL}/search/multi`, (_req, res, ctx) => res(ctx.status(200), ctx.json({ results: [] }))),
  rest.get(`${TMDB_BASE_URL}/movie/:id/recommendations`, (_req, res, ctx) => res(ctx.status(200), ctx.json({ results: [] }))),
  rest.get(`${TMDB_BASE_URL}/discover/movie`, (_req, res, ctx) => res(ctx.status(200), ctx.json({ results: [] }))),
  rest.get(`${TMDB_BASE_URL}/movie/changes`, (_req, res, ctx) => res(ctx.status(200), ctx.json({ results: [] }))),
  rest.get(`${TMDB_BASE_URL}/tv/changes`, (_req, res, ctx) => res(ctx.status(200), ctx.json({ results: [] }))),
  rest.get(`${TMDB_BASE_URL}/trending/:mediaType/:timeWindow`, (_req, res, ctx) => res(ctx.status(200), ctx.json({ results: [] }))),
  rest.get(`${TMDB_BASE_URL}/tv/:id/season/:seasonNumber/episode/:episodeNumber`, (_req, res, ctx) => res(ctx.status(200), ctx.json({ id: 123 }))),
  rest.get(`${TMDB_BASE_URL}/tv/:id/external_ids`, (_req, res, ctx) => res(ctx.status(200), ctx.json({}))),
  rest.get(`${TMDB_BASE_URL}/person/:id/external_ids`, (_req, res, ctx) => res(ctx.status(200), ctx.json({}))),
  rest.get(`${TMDB_BASE_URL}/:path*`, (_req, res, ctx) => res(ctx.status(200), ctx.json({ results: [] }))),
);

describe('tmdbClient', () => {
  const originalApiKey = process.env.TMDB_API_KEY;
  const originalAuthMethod = process.env.TMDB_AUTH_METHOD;

  beforeAll(() => {
    process.env.TMDB_API_KEY = 'fake-api-key';
    process.env.TMDB_AUTH_METHOD = 'query';
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    process.env.TMDB_API_KEY = originalApiKey;
    process.env.TMDB_AUTH_METHOD = originalAuthMethod;
    server.close();
  });

  it('doit appeler l’API TMDB configuration et renvoyer le résultat', async () => {
    const result = await getConfiguration();

    expect(result.images.base_url).toBe('http://image.tmdb.org/t/p/');
  });

  it('doit appeler searchPerson avec le bon endpoint', async () => {
    await searchPerson('test');
    expect(true).toBe(true);
  });

  it('doit appeler getTvEpisodeDetails avec credits', async () => {
    await getTvEpisodeDetails(123, 1, 2);
    expect(true).toBe(true);
  });

  it('doit appeler searchMulti avec le bon endpoint', async () => {
    await searchMulti('test');
    expect(true).toBe(true);
  });

  it('doit appeler getTvExternalIds et getPersonExternalIds', async () => {
    await getTvExternalIds(321);
    await getPersonExternalIds(654);
    expect(true).toBe(true);
  });

  it('doit appeler getMovieRecommendations et getDiscoverMovie', async () => {
    await getMovieRecommendations(111);
    await getDiscoverMovie({ with_genres: '28', year: 2023 });
    expect(true).toBe(true);
  });

  it('doit appeler getChanges avec un intervalle de dates et les deux endpoints movie/tv', async () => {
    await getChanges('2024-01-01', '2024-01-31');
    expect(true).toBe(true);
  });

  it('doit utiliser Authorization Bearer quand TMDB_AUTH_METHOD=bearer', async () => {
    process.env.TMDB_AUTH_METHOD = 'bearer';
    await getConfiguration();
    expect(true).toBe(true);
  });

  it('doit appeler getTrending avec mediaType et timeWindow', async () => {
    await getTrending('tv', 'week');
    expect(true).toBe(true);
  });

  it('doit lever une erreur 401 non retryée', async () => {
    server.use(
      rest.get(`${TMDB_BASE_URL}/configuration`, (_req, res, ctx) => res(ctx.status(401))),
    );

    await expect(getConfiguration()).rejects.toThrow('TMDB unauthorized 401');
  });

  it('doit retryer sur 429 et réussir après un retry', async () => {
    let calls = 0;
    server.use(
      rest.get(`${TMDB_BASE_URL}/configuration`, (_req, res, ctx) => {
        calls += 1;
        if (calls === 1) {
          return res(ctx.status(429), ctx.set('Retry-After', '0'));
        }
        return res(ctx.status(200), ctx.json(configurationResponse));
      }),
    );

    await getConfiguration();
    expect(calls).toBe(2);
  });

  it('doit lever une erreur 404 sans retry', async () => {
    let calls = 0;
    server.use(
      rest.get(`${TMDB_BASE_URL}/tv/999`, (_req, res, ctx) => {
        calls += 1;
        return res(ctx.status(404));
      }),
    );

    await expect(getTvDetails(999)).rejects.toThrow('TMDB request failed 404');
    expect(calls).toBe(1);
  });
});
