import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PeopleService } from './people.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@emdb/tmdb-client', () => ({
  searchPerson: jest.fn(),
}));

jest.mock('@emdb/tmdb-sync', () => ({
  importPersonByTmdbId: jest.fn(),
  refreshPersonData: jest.fn(),
  bootstrapPersonRecommendationsFromTmdb: jest.fn(),
}));

import { searchPerson } from '@emdb/tmdb-client';
import { importPersonByTmdbId, refreshPersonData, bootstrapPersonRecommendationsFromTmdb } from '@emdb/tmdb-sync';

const prismaServiceMock = {
  people: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  credits: {
    findMany: jest.fn(),
  },
  person_recommendations: {
    findMany: jest.fn(),
  },
};

describe('PeopleService', () => {
  let service: PeopleService;

  const mockPerson = {
    id: 'person-1',
    tmdb_id: 12345,
    nom: 'Jean Dupont',
    genre: 'homme',
    date_naissance: new Date('1970-01-15'),
    pays_id: 'fr-id',
    photo_url: 'https://image.tmdb.org/t/p/w500/photo.jpg',
    bio: 'Un acteur français célèbre.',
    wiki_url: 'https://fr.wikipedia.org/wiki/Jean_Dupont',
    source: 'tmdb',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    countries: {
      id: 'fr-id',
      code: 'FR',
      nom: 'France',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PeopleService, { provide: PrismaService, useValue: prismaServiceMock }],
    }).compile();

    service = module.get<PeopleService>(PeopleService);
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('fusionne les résultats TMDB et locaux', async () => {
      (searchPerson as jest.Mock).mockResolvedValue([
        { id: 1, name: 'Alice', poster_path: '/alice.jpg' },
        { id: 2, name: 'Bob', poster_path: null },
      ]);

      prismaServiceMock.people.findMany.mockResolvedValue([
        {
          id: 'local-1',
          tmdb_id: 1,
          nom: 'Alice',
          photo_url: 'https://image.tmdb.org/t/p/w500/alice.jpg',
        },
        {
          id: 'local-2',
          tmdb_id: null,
          nom: 'Charles',
          photo_url: null,
        },
      ]);

      const result = await service.search('Alice');

      expect(result).toHaveLength(3);
      // Alice (TMDB + local)
      expect(result[0]).toMatchObject({
        tmdb_id: 1,
        nom: 'Alice',
        local: true,
        local_id: 'local-1',
      });
      // Bob (TMDB seulement)
      expect(result[1]).toMatchObject({
        tmdb_id: 2,
        nom: 'Bob',
        local: false,
      });
      // Charles (local seulement, sans tmdb_id)
      expect(result[2]).toMatchObject({
        tmdb_id: 0,
        nom: 'Charles',
        local: true,
        local_id: 'local-2',
      });
    });

    it('retourne les résultats locaux si TMDB échoue', async () => {
      (searchPerson as jest.Mock).mockRejectedValue(new Error('API error'));

      prismaServiceMock.people.findMany.mockResolvedValue([
        {
          id: 'local-1',
          tmdb_id: 1,
          nom: 'Alice',
          photo_url: null,
        },
      ]);

      const result = await service.search('Alice');

      expect(result).toHaveLength(1);
      expect(result[0].nom).toBe('Alice');
    });

    it('retourne un tableau vide si aucun résultat', async () => {
      (searchPerson as jest.Mock).mockResolvedValue([]);
      prismaServiceMock.people.findMany.mockResolvedValue([]);

      const result = await service.search('Inexistant');

      expect(result).toEqual([]);
    });

    it('dédoublonne les résultats TMDB par id', async () => {
      (searchPerson as jest.Mock).mockResolvedValue([
        { id: 42, name: 'Doublon', poster_path: null },
        { id: 42, name: 'Doublon', poster_path: null },
      ]);

      prismaServiceMock.people.findMany.mockResolvedValue([]);

      const result = await service.search('Doublon');

      expect(result).toHaveLength(1);
    });
  });

  describe('getOrImportByTmdbId', () => {
    it('retourne la personne existante si trouvée par tmdb_id', async () => {
      prismaServiceMock.people.findUnique.mockResolvedValue(mockPerson);

      const result = await service.getOrImportByTmdbId(12345);

      expect(result).toEqual(mockPerson);
      expect(importPersonByTmdbId).not.toHaveBeenCalled();
    });

    it('déclenche l’import si la personne n’existe pas', async () => {
      prismaServiceMock.people.findUnique.mockResolvedValue(null);
      (importPersonByTmdbId as jest.Mock).mockResolvedValue(mockPerson);

      const result = await service.getOrImportByTmdbId(12345);

      expect(importPersonByTmdbId).toHaveBeenCalledWith(12345);
      expect(result).toEqual(mockPerson);
    });

    it('lève BadRequestException si tmdbId est invalide', async () => {
      await expect(service.getOrImportByTmdbId(0)).rejects.toThrow(BadRequestException);
      await expect(service.getOrImportByTmdbId(-1)).rejects.toThrow(BadRequestException);
      await expect(service.getOrImportByTmdbId(1.5)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getById', () => {
    it('retourne le détail complet si la personne existe', async () => {
      prismaServiceMock.people.findUnique.mockResolvedValue(mockPerson);

      const result = await service.getById('person-1');

      expect(result).toEqual(mockPerson);
      expect(prismaServiceMock.people.findUnique).toHaveBeenCalledWith({
        where: { id: 'person-1' },
        select: expect.any(Object),
      });
    });

    it('lève NotFoundException si la personne n’existe pas', async () => {
      prismaServiceMock.people.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFilmography', () => {
    it('retourne la filmographie groupée par rôle', async () => {
      prismaServiceMock.people.findUnique.mockResolvedValue({ id: 'person-1' });

      prismaServiceMock.credits.findMany.mockResolvedValue([
        {
          id: 'credit-1',
          personnage: 'Role A',
          ordre: 0,
          episode_id: null,
          titles: {
            id: 'title-1',
            tmdb_id: 100,
            titre_vo: 'Film Un',
            titre_vf: 'Film Un',
            affiche_url: null,
            type: 'film',
            date_sortie: new Date('2020-01-01'),
            note_imdb: 7.5,
          },
          roles: { code: 'acteur', libelle: 'Acteur' },
        },
        {
          id: 'credit-2',
          personnage: null,
          ordre: null,
          episode_id: null,
          titles: {
            id: 'title-2',
            tmdb_id: 200,
            titre_vo: 'Série Deux',
            titre_vf: 'Série Deux',
            affiche_url: null,
            type: 'serie',
            date_sortie: new Date('2021-06-15'),
            note_imdb: 8.0,
          },
          roles: { code: 'realisateur', libelle: 'Réalisateur' },
        },
      ]);

      const result = await service.getFilmography('person-1');

      expect(result).toHaveProperty('Acteur');
      expect(result).toHaveProperty('Réalisateur');
      expect(result.Acteur).toHaveLength(1);
      expect(result.Acteur[0].titre.titre_vo).toBe('Film Un');
    });

    it('lève NotFoundException si la personne n’existe pas', async () => {
      prismaServiceMock.people.findUnique.mockResolvedValue(null);

      await expect(service.getFilmography('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRecommendations', () => {
    it('retourne les recommandations si présentes', async () => {
      prismaServiceMock.people.findUnique.mockResolvedValue({ id: 'person-1', tmdb_id: 12345 });

      prismaServiceMock.person_recommendations.findMany.mockResolvedValue([
        {
          people_person_recommendations_recommended_idTopeople: {
            id: 'person-2',
            tmdb_id: 67890,
            nom: 'Marie Curie',
            photo_url: null,
            genre: 'femme',
            bio: 'Une autre personne.',
          },
        },
      ]);

      const result = await service.getRecommendations('person-1');

      expect(result).toHaveLength(1);
      expect(result[0].nom).toBe('Marie Curie');
      expect(bootstrapPersonRecommendationsFromTmdb).not.toHaveBeenCalled();
    });

    it('retourne un tableau vide si aucune recommandation et pas de tmdb_id', async () => {
      prismaServiceMock.people.findUnique.mockResolvedValue({ id: 'person-1', tmdb_id: null });
      prismaServiceMock.person_recommendations.findMany.mockResolvedValue([]);

      const result = await service.getRecommendations('person-1');

      expect(result).toEqual([]);
      expect(bootstrapPersonRecommendationsFromTmdb).not.toHaveBeenCalled();
    });

    it('appelle le fallback TMDB si pas de recommandations locales et tmdb_id présent', async () => {
      prismaServiceMock.people.findUnique.mockResolvedValue({ id: 'person-1', tmdb_id: 12345 });
      // Premier appel : pas de recommandations locales
      prismaServiceMock.person_recommendations.findMany
        .mockResolvedValueOnce([])
        // Deuxième appel : après bootstrap, des recommandations existent
        .mockResolvedValueOnce([
          {
            people_person_recommendations_recommended_idTopeople: {
              id: 'person-2',
              tmdb_id: 67890,
              nom: 'Marie Curie',
              photo_url: null,
              genre: 'femme',
              bio: 'Une autre personne.',
            },
          },
        ]);

      (bootstrapPersonRecommendationsFromTmdb as jest.Mock).mockResolvedValue(1);

      const result = await service.getRecommendations('person-1');

      expect(bootstrapPersonRecommendationsFromTmdb).toHaveBeenCalledWith('person-1');
      expect(result).toHaveLength(1);
      expect(result[0].nom).toBe('Marie Curie');
    });

    it('retourne un tableau vide si TMDB échoue (catch silencieux)', async () => {
      prismaServiceMock.people.findUnique.mockResolvedValue({ id: 'person-1', tmdb_id: 12345 });
      prismaServiceMock.person_recommendations.findMany.mockResolvedValue([]);

      (bootstrapPersonRecommendationsFromTmdb as jest.Mock).mockRejectedValue(new Error('TMDB error'));

      const result = await service.getRecommendations('person-1');

      expect(result).toEqual([]);
    });

    it('lève NotFoundException si la personne n\'existe pas', async () => {
      prismaServiceMock.people.findUnique.mockResolvedValue(null);

      await expect(service.getRecommendations('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('refresh', () => {
    it('appelle refreshPersonData si la personne a un tmdb_id', async () => {
      const mockPersonForRefresh = { id: 'person-1', tmdb_id: 12345 };
      prismaServiceMock.people.findUnique.mockResolvedValue(mockPersonForRefresh);
      (refreshPersonData as jest.Mock).mockResolvedValue({
        ...mockPerson,
        nom: 'Jean Dupont (mis à jour)',
      });

      const result = await service.refresh('person-1');

      expect(refreshPersonData).toHaveBeenCalledWith('person-1');
      expect(result.nom).toBe('Jean Dupont (mis à jour)');
    });

    it('lève BadRequestException si la personne n’a pas de tmdb_id', async () => {
      prismaServiceMock.people.findUnique.mockResolvedValue({
        id: 'person-1',
        tmdb_id: null,
      });

      await expect(service.refresh('person-1')).rejects.toThrow(BadRequestException);
    });

    it('lève NotFoundException si la personne n’existe pas', async () => {
      prismaServiceMock.people.findUnique.mockResolvedValue(null);

      await expect(service.refresh('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
