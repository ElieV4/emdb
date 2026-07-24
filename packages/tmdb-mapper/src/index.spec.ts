import {
  mapTmdbEpisodeCredits,
  mapTmdbPersonExternalIds,
  mapTmdbMovieToTitle,
  mapTmdbTvToTitle,
} from './index';

describe('tmdb-mapper', () => {
  it('mappe les crédits d épisode avec episode_id', () => {
    const episodeId = 'episode-uuid';
    const credits = mapTmdbEpisodeCredits(
      {
        id: 1,
        crew: [
          { id: 11, name: 'Réalisateur', job: 'Director', department: 'Directing' },
          { id: 12, name: 'Scénariste', job: 'Writer', department: 'Writing' },
        ],
        guest_stars: [{ id: 21, name: 'Acteur invité', character: 'Personnage', order: 1 }],
      },
      episodeId,
    );

    expect(credits).toEqual([
      {
        tmdb_person_id: 21,
        role: 'acteur',
        personnage: 'Personnage',
        ordre: 1,
        episode_id: episodeId,
        source: 'tmdb',
      },
      {
        tmdb_person_id: 11,
        role: 'realisateur',
        episode_id: episodeId,
        source: 'tmdb',
      },
      {
        tmdb_person_id: 12,
        role: 'scenariste',
        episode_id: episodeId,
        source: 'tmdb',
      },
    ]);
  });

  it('extrait le wikidata_id depuis les external ids TMDB', () => {
    expect(mapTmdbPersonExternalIds({ imdb_id: 'nm0000001', wikidata_id: 'Q12345' })).toEqual({
      imdb_id: 'nm0000001',
      wikidata_id: 'Q12345',
    });
  });

  it('mappe un film TMDB en payload title', () => {
    expect(
      mapTmdbMovieToTitle({
        id: 1,
        title: 'Titre VF',
        original_title: 'Original Title',
        overview: 'Synopsis',
        release_date: '2024-01-01',
        runtime: 120,
        vote_average: 8.1,
        poster_path: '/poster.jpg',
      }),
    ).toMatchObject({
      tmdb_id: 1,
      type: 'film',
      titre_vo: 'Original Title',
      titre_vf: 'Titre VF',
      synopsis: 'Synopsis',
      duree_minutes: 120,
      note_imdb: 8.1,
      affiche_url: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    });
  });

  it('mappe une série TMDB en payload title', () => {
    expect(
      mapTmdbTvToTitle({
        id: 2,
        name: 'Titre VF',
        original_name: 'Original Name',
        overview: 'Synopsis série',
        first_air_date: '2024-01-01',
        episode_run_time: [45],
        vote_average: 7.5,
        poster_path: '/poster.jpg',
        status: 'Returning Series',
        next_episode_to_air: { air_date: '2024-06-01' },
      }),
    ).toMatchObject({
      tmdb_id: 2,
      type: 'serie',
      titre_vo: 'Original Name',
      titre_vf: 'Titre VF',
      synopsis: 'Synopsis série',
      duree_minutes: 45,
      note_imdb: 7.5,
      statut_serie: 'en_cours',
      next_episode_air_date: new Date('2024-06-01'),
    });
  });
});
