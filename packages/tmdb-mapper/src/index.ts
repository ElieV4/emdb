export type TmdbEpisodeCreditCast = {
  id: number;
  name: string;
  character: string;
  order: number;
};

export type TmdbEpisodeCreditCrew = {
  id: number;
  name: string;
  job: string;
  department: string;
};

export type TmdbEpisodeCredits = {
  id: number;
  crew: TmdbEpisodeCreditCrew[];
  guest_stars: TmdbEpisodeCreditCast[];
};

export type EpisodeCreditInsert = {
  tmdb_person_id: number;
  role: 'acteur' | 'realisateur' | 'scenariste' | 'autre';
  personnage?: string;
  ordre?: number;
  episode_id: string;
  source: 'tmdb';
};

export type TmdbExternalIds = {
  imdb_id?: string | null;
  wikidata_id?: string | null;
  [key: string]: string | number | null | undefined;
};

export type TmdbGenre = {
  id: number;
  name: string;
};

export type TmdbCountry = {
  iso_3166_1: string;
  name: string;
};

export type TmdbMovieDetails = {
  id: number;
  title: string;
  original_title: string;
  overview?: string;
  release_date?: string;
  runtime?: number;
  vote_average?: number;
  poster_path?: string | null;
  genres?: TmdbGenre[];
  production_countries?: TmdbCountry[];
};

export type TmdbTvDetails = {
  id: number;
  name: string;
  original_name: string;
  overview?: string;
  first_air_date?: string;
  episode_run_time?: number[];
  vote_average?: number;
  poster_path?: string | null;
  genres?: TmdbGenre[];
  production_countries?: TmdbCountry[];
  status?: string;
  next_episode_to_air?: { air_date?: string } | null;
};

export function mapTmdbEpisodeCredits(
  tmdbEpisodeCredits: TmdbEpisodeCredits,
  episodeId: string,
): EpisodeCreditInsert[] {
  const mapped: EpisodeCreditInsert[] = [];

  for (const guestStar of tmdbEpisodeCredits.guest_stars || []) {
    mapped.push({
      tmdb_person_id: guestStar.id,
      role: 'acteur',
      personnage: guestStar.character,
      ordre: guestStar.order,
      episode_id: episodeId,
      source: 'tmdb',
    });
  }

  for (const crewMember of tmdbEpisodeCredits.crew || []) {
    const role =
      crewMember.job === 'Director'
        ? 'realisateur'
        : crewMember.job === 'Writer' || crewMember.job === 'Screenplay'
        ? 'scenariste'
        : 'autre';

    mapped.push({
      tmdb_person_id: crewMember.id,
      role,
      episode_id: episodeId,
      source: 'tmdb',
    });
  }

  return mapped;
}

export function mapTmdbPersonExternalIds(
  tmdbExternalIds: TmdbExternalIds,
): { imdb_id?: string | null; wikidata_id?: string | null } {
  return {
    imdb_id: tmdbExternalIds.imdb_id ?? null,
    wikidata_id: tmdbExternalIds.wikidata_id ?? null,
  };
}

export function mapTmdbMovieToTitle(tmdbMovie: TmdbMovieDetails) {
  return {
    tmdb_id: tmdbMovie.id,
    type: 'film',
    titre_vo: tmdbMovie.original_title,
    titre_vf: tmdbMovie.title,
    synopsis: tmdbMovie.overview ?? null,
    date_sortie: tmdbMovie.release_date ? new Date(tmdbMovie.release_date) : null,
    duree_minutes: tmdbMovie.runtime ?? null,
    note_imdb: tmdbMovie.vote_average ?? null,
    affiche_url: tmdbMovie.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}` : null,
    statut_serie: null,
    next_episode_air_date: null,
    source: 'tmdb' as const,
  };
}

export function mapTmdbTvToTitle(tmdbTv: TmdbTvDetails) {
  const statusMap: Record<string, string> = {
    Returning: 'en_cours',
    'Returning Series': 'en_cours',
    Ended: 'terminee',
    Canceled: 'annulee',
    Cancelled: 'annulee',
  };

  return {
    tmdb_id: tmdbTv.id,
    type: 'serie',
    titre_vo: tmdbTv.original_name,
    titre_vf: tmdbTv.name,
    synopsis: tmdbTv.overview ?? null,
    date_sortie: tmdbTv.first_air_date ? new Date(tmdbTv.first_air_date) : null,
    duree_minutes: tmdbTv.episode_run_time?.[0] ?? null,
    note_imdb: tmdbTv.vote_average ?? null,
    affiche_url: tmdbTv.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbTv.poster_path}` : null,
    statut_serie: tmdbTv.status ? statusMap[tmdbTv.status] ?? tmdbTv.status.toLowerCase() : null,
    next_episode_air_date: tmdbTv.next_episode_to_air?.air_date
      ? new Date(tmdbTv.next_episode_to_air.air_date)
      : null,
    source: 'tmdb' as const,
  };
}
