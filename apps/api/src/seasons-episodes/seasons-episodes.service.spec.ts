import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SeasonsEpisodesService } from './seasons-episodes.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaServiceMock = {
  titles: {
    findUnique: jest.fn(),
  },
  seasons: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  episodes: {
    findUnique: jest.fn(),
  },
  credits: {
    findMany: jest.fn(),
  },
};

describe('SeasonsEpisodesService', () => {
  let service: SeasonsEpisodesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeasonsEpisodesService, { provide: PrismaService, useValue: prismaServiceMock }],
    }).compile();

    service = module.get<SeasonsEpisodesService>(SeasonsEpisodesService);
    jest.clearAllMocks();
  });

  // ============================================================
  // listSeasons
  // ============================================================
  describe('listSeasons', () => {
    it("retourne la liste des saisons avec le nombre d'épisodes", async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: 'title-1' });

      const mockSeasons = [
        {
          id: 'season-1',
          numero: 1,
          titre: 'Saison 1',
          date_sortie: new Date('2020-01-01'),
          synopsis: 'Première saison',
          _count: { episodes: 10 },
        },
        {
          id: 'season-2',
          numero: 2,
          titre: 'Saison 2',
          date_sortie: new Date('2021-01-01'),
          synopsis: 'Deuxième saison',
          _count: { episodes: 12 },
        },
      ];
      prismaServiceMock.seasons.findMany.mockResolvedValue(mockSeasons);

      const result = await service.listSeasons('title-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        numero: 1,
        titre: 'Saison 1',
        nombre_episodes: 10,
      });
      expect(result[1].nombre_episodes).toBe(12);
      expect(prismaServiceMock.seasons.findMany).toHaveBeenCalledWith({
        where: { title_id: 'title-1' },
        orderBy: { numero: 'asc' },
        include: { _count: { select: { episodes: true } } },
      });
    });

    it("lève NotFoundException si le titre n'existe pas", async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue(null);

      await expect(service.listSeasons('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it("retourne un tableau vide si le titre n'a pas de saisons", async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: 'title-1' });
      prismaServiceMock.seasons.findMany.mockResolvedValue([]);

      const result = await service.listSeasons('title-1');

      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // getSeason
  // ============================================================
  describe('getSeason', () => {
    const mockSeason = {
      id: 'season-1',
      numero: 1,
      titre: 'Saison 1',
      date_sortie: new Date('2020-01-01'),
      synopsis: 'Synopsis',
      episodes: [
        {
          id: 'ep-1',
          numero: 1,
          titre: 'Épisode 1',
          synopsis: 'Début',
          date_sortie: new Date('2020-01-01'),
          duree_minutes: 45,
          image_url: null,
        },
        {
          id: 'ep-2',
          numero: 2,
          titre: 'Épisode 2',
          synopsis: 'Suite',
          date_sortie: new Date('2020-01-08'),
          duree_minutes: 42,
          image_url: null,
        },
      ],
    };

    it('retourne la saison avec ses épisodes', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: 'title-1' });
      prismaServiceMock.seasons.findUnique.mockResolvedValue(mockSeason);

      const result = await service.getSeason('title-1', 1);

      expect(result).toEqual(mockSeason);
      expect(result.episodes).toHaveLength(2);
      expect(result.episodes[0].numero).toBe(1);
      expect(result.episodes[1].numero).toBe(2);
    });

    it("lève NotFoundException si le titre n'existe pas", async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue(null);

      await expect(service.getSeason('nonexistent', 1)).rejects.toThrow(NotFoundException);
    });

    it("lève NotFoundException si la saison n'existe pas", async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: 'title-1' });
      prismaServiceMock.seasons.findUnique.mockResolvedValue(null);

      await expect(service.getSeason('title-1', 99)).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // getEpisode
  // ============================================================
  describe('getEpisode', () => {
    const mockEpisode = {
      id: 'ep-1',
      numero: 1,
      titre: 'Pilot',
      synopsis: 'Premier épisode',
      date_sortie: new Date('2020-01-01'),
      duree_minutes: 45,
      image_url: null,
      season_id: 'season-1',
      seasons: {
        id: 'season-1',
        numero: 1,
        titre: 'Saison 1',
        title_id: 'title-1',
      },
    };

    it("retourne le détail de l'épisode avec sa saison", async () => {
      prismaServiceMock.episodes.findUnique.mockResolvedValue(mockEpisode);

      const result = await service.getEpisode('ep-1');

      expect(result).toEqual(mockEpisode);
      expect(result.seasons.numero).toBe(1);
    });

    it("lève NotFoundException si l'épisode n'existe pas", async () => {
      prismaServiceMock.episodes.findUnique.mockResolvedValue(null);

      await expect(service.getEpisode('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // getEpisodeCredits
  // ============================================================
  describe('getEpisodeCredits', () => {
    it('retourne les credits groupés par rôle', async () => {
      prismaServiceMock.episodes.findUnique.mockResolvedValue({ id: 'ep-1' });

      prismaServiceMock.credits.findMany.mockResolvedValue([
        {
          id: 'credit-1',
          personnage: 'Guest Star',
          ordre: 0,
          people: {
            id: 'person-1',
            tmdb_id: 123,
            nom: 'John Doe',
            photo_url: null,
          },
          roles: { code: 'acteur', libelle: 'Acteur' },
        },
        {
          id: 'credit-2',
          personnage: null,
          ordre: null,
          people: {
            id: 'person-2',
            tmdb_id: 456,
            nom: 'Jane Smith',
            photo_url: null,
          },
          roles: { code: 'realisateur', libelle: 'Réalisateur' },
        },
      ]);

      const result = await service.getEpisodeCredits('ep-1');

      expect(result).toHaveProperty('Acteur');
      expect(result).toHaveProperty('Réalisateur');
      expect(result.Acteur).toHaveLength(1);
      expect(result.Acteur[0].personne.nom).toBe('John Doe');
    });

    it("retourne un objet vide si aucun credit d'épisode", async () => {
      prismaServiceMock.episodes.findUnique.mockResolvedValue({ id: 'ep-1' });
      prismaServiceMock.credits.findMany.mockResolvedValue([]);

      const result = await service.getEpisodeCredits('ep-1');

      expect(result).toEqual({});
    });

    it("lève NotFoundException si l'épisode n'existe pas", async () => {
      prismaServiceMock.episodes.findUnique.mockResolvedValue(null);

      await expect(service.getEpisodeCredits('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
