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
  credits?: TmdbCredits;
};

export type TmdbSeasonDetails = {
  season_number: number;
  name?: string;
  air_date?: string;
  overview?: string;
  episodes?: TmdbEpisodeDetails[];
};

export type TmdbEpisodeDetails = {
  episode_number: number;
  name?: string;
  overview?: string;
  air_date?: string;
  runtime?: number;
  still_path?: string;
};

export type TmdbPersonDetails = {
  id: number;
  name: string;
  gender?: number;
  birthday?: string | null;
  place_of_birth?: string | null;
  profile_path?: string | null;
  biography?: string | null;
};

export type TitleInsert = {
  tmdb_id: number;
  type: 'film' | 'serie';
  titre_vo: string;
  titre_vf: string;
  synopsis: string | null;
  date_sortie: Date | null;
  duree_minutes: number | null;
  note_imdb: number | null;
  affiche_url: string | null;
  statut_serie: string | null;
  next_episode_air_date: Date | null;
  source: 'tmdb';
};

export type GenreInsert = {
  tmdb_id: number;
  nom: string;
};

export type CountryInsert = {
  code: string;
  nom: string;
};

export type CreditInsert = {
  tmdb_person_id: number;
  role: 'acteur' | 'realisateur' | 'scenariste' | 'autre';
  personnage?: string | null;
  ordre?: number | null;
  title_id: string;
  episode_id?: string | null;
  source: 'tmdb';
};

export type PersonInsert = {
  tmdb_id: number;
  nom: string;
  genre: 'homme' | 'femme' | 'autre';
  date_naissance: Date | null;
  pays_id: string | null;
  photo_url: string | null;
  bio: string | null;
  wiki_url: string | null;
  source: 'tmdb';
};

export type SeasonInsert = {
  title_id: string;
  numero: number;
  titre: string | null;
  date_sortie: Date | null;
  synopsis: string | null;
};

export type EpisodeInsert = {
  season_id: string;
  numero: number;
  titre: string | null;
  synopsis: string | null;
  date_sortie: Date | null;
  duree_minutes: number | null;
  image_url: string | null;
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

export function mapTmdbGenres(tmdbGenres: TmdbGenre[]): GenreInsert[] {
  return tmdbGenres.map((genre) => ({
    tmdb_id: genre.id,
    nom: genre.name,
  }));
}

export function mapTmdbCountries(tmdbCountries: TmdbCountry[]): CountryInsert[] {
  return tmdbCountries.map((country) => ({
    code: country.iso_3166_1,
    nom: country.name,
  }));
}

export function mapTmdbCredits(
  tmdbCredits: TmdbCredits | undefined,
  titleId: string,
  episodeId?: string | null,
): CreditInsert[] {
  const credits: CreditInsert[] = [];

  for (const castMember of tmdbCredits?.cast || []) {
    credits.push({
      tmdb_person_id: castMember.id,
      role: 'acteur',
      personnage: castMember.character ?? null,
      ordre: castMember.order ?? null,
      title_id: titleId,
      episode_id: episodeId ?? null,
      source: 'tmdb',
    });
  }

  for (const crewMember of tmdbCredits?.crew || []) {
    const role =
      crewMember.job === 'Director'
        ? 'realisateur'
        : crewMember.job === 'Writer' || crewMember.job === 'Screenplay'
        ? 'scenariste'
        : 'autre';

    credits.push({
      tmdb_person_id: crewMember.id,
      role,
      personnage: null,
      ordre: null,
      title_id: titleId,
      episode_id: episodeId ?? null,
      source: 'tmdb',
    });
  }

  return credits;
}

export function mapTmdbPerson(tmdbPerson: TmdbPersonDetails, wikiUrl: string | null): PersonInsert {
  const genderMap: Record<number, PersonInsert['genre']> = {
    1: 'femme',
    2: 'homme',
  };

  return {
    tmdb_id: tmdbPerson.id,
    nom: tmdbPerson.name,
    genre: genderMap[tmdbPerson.gender ?? 0] ?? 'autre',
    date_naissance: tmdbPerson.birthday ? new Date(tmdbPerson.birthday) : null,
    pays_id: null,
    photo_url: tmdbPerson.profile_path ? `https://image.tmdb.org/t/p/w500${tmdbPerson.profile_path}` : null,
    bio: tmdbPerson.biography ?? null,
    wiki_url: wikiUrl,
    source: 'tmdb',
  };
}

export function mapTmdbSeason(tmdbSeason: TmdbSeasonDetails, titleId: string): SeasonInsert {
  return {
    title_id: titleId,
    numero: tmdbSeason.season_number,
    titre: tmdbSeason.name ?? null,
    date_sortie: tmdbSeason.air_date ? new Date(tmdbSeason.air_date) : null,
    synopsis: tmdbSeason.overview ?? null,
  };
}

export function mapTmdbEpisode(tmdbEpisode: TmdbEpisodeDetails, seasonId: string): EpisodeInsert {
  return {
    season_id: seasonId,
    numero: tmdbEpisode.episode_number,
    titre: tmdbEpisode.name ?? null,
    synopsis: tmdbEpisode.overview ?? null,
    date_sortie: tmdbEpisode.air_date ? new Date(tmdbEpisode.air_date) : null,
    duree_minutes: tmdbEpisode.runtime ?? null,
    image_url: tmdbEpisode.still_path ? `https://image.tmdb.org/t/p/w500${tmdbEpisode.still_path}` : null,
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
