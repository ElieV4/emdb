import Redis from 'ioredis';

export type TmdbSearchResult = {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
};

export type TmdbConfig = {
  images: {
    base_url: string;
    secure_base_url: string;
    backdrop_sizes: string[];
    logo_sizes: string[];
    poster_sizes: string[];
    profile_sizes: string[];
    still_sizes: string[];
  };
};

const TMDB_BASE_URL = process.env.TMDB_BASE_URL ?? 'https://api.themoviedb.org/3';
const TMDB_CACHE_REDIS_URL = process.env.TMDB_CACHE_REDIS_URL ?? process.env.REDIS_URL;
const TMDB_CACHE_TTL_SECONDS = Number(process.env.TMDB_CACHE_TTL_SECONDS ?? '86400');
const TMDB_MAX_REQUESTS = Number(process.env.TMDB_MAX_REQUESTS ?? '40');
const TMDB_REQUEST_INTERVAL_MS = Number(process.env.TMDB_REQUEST_INTERVAL_MS ?? '10000');
const TMDB_MAX_RETRIES = Number(process.env.TMDB_MAX_RETRIES ?? '3');
const TMDB_RETRY_BASE_DELAY_MS = Number(process.env.TMDB_RETRY_BASE_DELAY_MS ?? '50');

function getTmdbAuthMethod(): string {
  return (process.env.TMDB_AUTH_METHOD ?? 'query').toLowerCase();
}

function getTmdbApiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB_API_KEY is required in environment variables');
  }
  return key;
}

function authHeaders(): Record<string, string> {
  if (getTmdbAuthMethod() === 'bearer') {
    return {
      Authorization: `Bearer ${getTmdbApiKey()}`,
    };
  }

  return {};
}

function buildUrl(path: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(`${TMDB_BASE_URL}${path}`);

  if (getTmdbAuthMethod() !== 'bearer') {
    url.searchParams.set('api_key', getTmdbApiKey());
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!TMDB_CACHE_REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(TMDB_CACHE_REDIS_URL, {
      keyPrefix: 'tmdb-client:',
    });
    redisClient.on('error', () => {
      // Silencieux en cas d'indisponibilité de Redis, on retombe sur l'API TMDB.
    });
  }

  return redisClient;
}

async function getCache<T>(key: string): Promise<T | undefined> {
  const client = getRedisClient();
  if (!client) {
    return undefined;
  }
  const cached = await client.get(key);
  if (!cached) {
    return undefined;
  }
  try {
    return JSON.parse(cached) as T;
  } catch {
    return undefined;
  }
}

async function setCache<T>(key: string, value: T): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    return;
  }
  await client.set(key, JSON.stringify(value), 'EX', TMDB_CACHE_TTL_SECONDS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(retryAfter: string | null): number | null {
  if (!retryAfter) {
    return null;
  }

  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds)) {
    return seconds * 1000;
  }

  const parsedDate = Date.parse(retryAfter);
  if (!Number.isNaN(parsedDate)) {
    return Math.max(parsedDate - Date.now(), 0);
  }

  return null;
}

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private queue: Array<() => void> = [];

  constructor(private readonly maxRequests: number, private readonly intervalMs: number) {
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    if (now - this.lastRefill >= this.intervalMs) {
      this.tokens = this.maxRequests;
      this.lastRefill = now;
      while (this.tokens > 0 && this.queue.length > 0) {
        const next = this.queue.shift();
        if (!next) {
          break;
        }
        this.tokens -= 1;
        next();
      }
    }
  }

  public async schedule<T>(callback: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = () => {
        callback().then(resolve, reject);
      };

      this.refill();

      if (this.tokens > 0) {
        this.tokens -= 1;
        execute();
        return;
      }

      this.queue.push(execute);
      const delay = Math.max(this.intervalMs - (Date.now() - this.lastRefill), 0);
      setTimeout(() => this.refill(), delay);
    });
  }
}

const tmdbRateLimiter = new RateLimiter(TMDB_MAX_REQUESTS, TMDB_REQUEST_INTERVAL_MS);

async function fetchJson<T>(url: string): Promise<T> {
  const cacheKey = `url:${url}`;
  const cached = await getCache<T>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < TMDB_MAX_RETRIES) {
    attempt += 1;
    const response = await tmdbRateLimiter.schedule(() =>
      fetch(url, {
        headers: {
          Accept: 'application/json',
          ...authHeaders(),
        },
      }),
    );

    if (response.ok) {
      const body = (await response.json()) as T;
      await setCache(cacheKey, body);
      return body;
    }

    if (response.status === 401) {
      throw new Error(`TMDB unauthorized 401: Invalid API key or token for ${url}`);
    }

    if (response.status === 404) {
      throw new Error(`TMDB request failed 404: Not Found for ${url}`);
    }

    if (response.status === 429 || response.status >= 500) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryDelay = parseRetryAfter(retryAfterHeader) ?? TMDB_RETRY_BASE_DELAY_MS * attempt;
      lastError = new Error(`TMDB request failed ${response.status}: ${response.statusText}`);
      if (attempt >= TMDB_MAX_RETRIES) {
        break;
      }
      await sleep(retryDelay);
      continue;
    }

    throw new Error(`TMDB request failed ${response.status}: ${response.statusText}`);
  }

  throw lastError ?? new Error('TMDB request failed after retries');
}

export async function searchMovie(query: string, year?: number): Promise<TmdbSearchResult[]> {
  const url = buildUrl('/search/movie', {
    query,
    year,
  });
  const data = await fetchJson<{ results: TmdbSearchResult[] }>(url);
  return data.results;
}

export async function searchTv(query: string, year?: number): Promise<TmdbSearchResult[]> {
  const url = buildUrl('/search/tv', {
    query,
    first_air_date_year: year,
  });
  const data = await fetchJson<{ results: TmdbSearchResult[] }>(url);
  return data.results;
}

export async function searchPerson(query: string): Promise<TmdbSearchResult[]> {
  const url = buildUrl('/search/person', {
    query,
  });
  const data = await fetchJson<{ results: TmdbSearchResult[] }>(url);
  return data.results;
}

export async function searchMulti(query: string): Promise<TmdbSearchResult[]> {
  const url = buildUrl('/search/multi', {
    query,
  });
  const data = await fetchJson<{ results: TmdbSearchResult[] }>(url);
  return data.results;
}

export async function getConfiguration(): Promise<TmdbConfig> {
  const url = buildUrl('/configuration');
  return fetchJson<TmdbConfig>(url);
}

export async function getMovieDetails(tmdbId: number): Promise<any> {
  const url = buildUrl(`/movie/${tmdbId}`, {
    append_to_response: 'credits,images,videos',
  });
  return fetchJson<any>(url);
}

export async function getTvDetails(tmdbId: number): Promise<any> {
  const url = buildUrl(`/tv/${tmdbId}`, {
    append_to_response: 'credits,images,content_ratings',
  });
  return fetchJson<any>(url);
}

export async function getTvSeason(tmdbId: number, seasonNumber: number): Promise<any> {
  const url = buildUrl(`/tv/${tmdbId}/season/${seasonNumber}`);
  return fetchJson<any>(url);
}

export async function getPersonDetails(personTmdbId: number): Promise<any> {
  const url = buildUrl(`/person/${personTmdbId}`);
  return fetchJson<any>(url);
}

export async function getPersonCombinedCredits(personTmdbId: number): Promise<any> {
  const url = buildUrl(`/person/${personTmdbId}/combined_credits`);
  return fetchJson<any>(url);
}

export async function getGenreListMovie(): Promise<any> {
  const url = buildUrl('/genre/movie/list');
  return fetchJson<any>(url);
}

export async function getGenreListTv(): Promise<any> {
  const url = buildUrl('/genre/tv/list');
  return fetchJson<any>(url);
}

export async function getMovieExternalIds(tmdbId: number): Promise<any> {
  const url = buildUrl(`/movie/${tmdbId}/external_ids`);
  return fetchJson<any>(url);
}

export async function getTvExternalIds(tmdbId: number): Promise<any> {
  const url = buildUrl(`/tv/${tmdbId}/external_ids`);
  return fetchJson<any>(url);
}

export async function getPersonExternalIds(personTmdbId: number): Promise<any> {
  const url = buildUrl(`/person/${personTmdbId}/external_ids`);
  return fetchJson<any>(url);
}

export async function getTvEpisodeDetails(tmdbId: number, seasonNumber: number, episodeNumber: number): Promise<any> {
  const url = buildUrl(`/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}`, {
    append_to_response: 'credits',
  });
  return fetchJson<any>(url);
}

export async function getMovieImages(tmdbId: number): Promise<any> {
  const url = buildUrl(`/movie/${tmdbId}/images`);
  return fetchJson<any>(url);
}

export async function getTvImages(tmdbId: number): Promise<any> {
  const url = buildUrl(`/tv/${tmdbId}/images`);
  return fetchJson<any>(url);
}

export async function getPersonImages(personTmdbId: number): Promise<any> {
  const url = buildUrl(`/person/${personTmdbId}/images`);
  return fetchJson<any>(url);
}

export async function getMovieVideos(tmdbId: number): Promise<any> {
  const url = buildUrl(`/movie/${tmdbId}/videos`);
  return fetchJson<any>(url);
}

export async function getTvVideos(tmdbId: number): Promise<any> {
  const url = buildUrl(`/tv/${tmdbId}/videos`);
  return fetchJson<any>(url);
}

export async function getMovieRecommendations(tmdbId: number): Promise<any> {
  const url = buildUrl(`/movie/${tmdbId}/recommendations`);
  return fetchJson<any>(url);
}

export async function getMovieSimilar(tmdbId: number): Promise<any> {
  const url = buildUrl(`/movie/${tmdbId}/similar`);
  return fetchJson<any>(url);
}

export async function getTvRecommendations(tmdbId: number): Promise<any> {
  const url = buildUrl(`/tv/${tmdbId}/recommendations`);
  return fetchJson<any>(url);
}

export async function getTvSimilar(tmdbId: number): Promise<any> {
  const url = buildUrl(`/tv/${tmdbId}/similar`);
  return fetchJson<any>(url);
}

export async function getCollectionDetails(collectionId: number): Promise<any> {
  const url = buildUrl(`/collection/${collectionId}`);
  return fetchJson<any>(url);
}

export async function getTrending(mediaType: 'movie' | 'tv' | 'person', timeWindow: 'day' | 'week'): Promise<any> {
  const url = buildUrl(`/trending/${mediaType}/${timeWindow}`);
  return fetchJson<any>(url);
}

export async function getDiscoverMovie(filters: Record<string, string | number | undefined>): Promise<any> {
  const url = buildUrl('/discover/movie', filters);
  return fetchJson<any>(url);
}

export async function getDiscoverTv(filters: Record<string, string | number | undefined>): Promise<any> {
  const url = buildUrl('/discover/tv', filters);
  return fetchJson<any>(url);
}

export async function getChanges(startDate: string, endDate: string): Promise<any> {
  const movieChanges = await fetchJson<any>(
    buildUrl('/movie/changes', {
      start_date: startDate,
      end_date: endDate,
    }),
  );

  const tvChanges = await fetchJson<any>(
    buildUrl('/tv/changes', {
      start_date: startDate,
      end_date: endDate,
    }),
  );

  return {
    movie: movieChanges,
    tv: tvChanges,
  };
}
