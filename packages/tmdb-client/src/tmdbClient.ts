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

function getTmdbApiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB_API_KEY is required in environment variables');
  }
  return key;
}

function buildUrl(path: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set('api_key', getTmdbApiKey());
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`TMDB request failed ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
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
  const url = buildUrl('/movie/changes', {
    start_date: startDate,
    end_date: endDate,
  });
  return fetchJson<any>(url);
}
