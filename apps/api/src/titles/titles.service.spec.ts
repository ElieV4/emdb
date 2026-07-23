import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TitlesService } from './titles.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@emdb/tmdb-client', () => ({
  searchMovie: jest.fn(),
  searchTv: jest.fn(),
  getMovieRecommendations: jest.fn(),
  getMovieSimilar: jest.fn(),
  getTvRecommendations: jest.fn(),
  getTvSimilar: jest.fn(),
}));

jest.mock('@emdb/tmdb-sync', () => ({
  importTitleByTmdbId: jest.fn(),
  refreshTitleData: jest.fn(),
}));

import {
  getMovieRecommendations,
  getMovieSimilar,
} from '@emdb/tmdb-client';
import { importTitleByTmdbId, refreshTitleData } from '@emdb/tmdb-sync';

const prismaServiceMock = {
  titles: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  title_recommendations: {
    findMany: jest.fn(),
  },
  user_ratings: { count: jest.fn() },
  user_watches: { count: jest.fn() },
  list_items: { count: jest.fn() },
};

describe('TitlesService', () => {
  let service: TitlesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TitlesService,
        { provide: PrismaService, useValue: prismaServiceMock },
      ],
    }).compile();

    service = module.get<TitlesService>(TitlesService);
    jest.clearAllMocks();
  });

  describe('getTitleDetail', () => {
    it('retourne le titre avec ses relations si trouvé', async () => {
      const mockTitle = { id: '1', titre_vo: 'Test', title_genres: [] };
      prismaServiceMock.titles.findUnique.mockResolvedValue(mockTitle);

      const result = await service.getTitleDetail('1');

      expect(result).toEqual(mockTitle);
      expect(prismaServiceMock.titles.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: expect.any(Object),
      });
    });

    it('lève NotFoundException si le titre n’existe pas', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue(null);

      await expect(service.getTitleDetail('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrImportByTmdbId', () => {
    it('retourne le titre existant si trouvé par tmdb_id', async () => {
      const mockTitle = { id: '1', tmdb_id: 123, titre_vo: 'Test' };
      prismaServiceMock.titles.findUnique.mockResolvedValue(mockTitle);

      const result = await service.getOrImportByTmdbId(123, 'film');

      expect(result).toEqual(mockTitle);
    });

    it('déclenche l’import si le titre n’existe pas', async () => {
      const mockImported = { id: '2', tmdb_id: 456, titre_vo: 'Imported' };
      prismaServiceMock.titles.findUnique.mockResolvedValue(null);
      (importTitleByTmdbId as jest.Mock).mockResolvedValue(mockImported);

      const result = await service.getOrImportByTmdbId(456, 'film');

      expect(importTitleByTmdbId).toHaveBeenCalledWith(456, 'film');
      expect(result).toEqual(mockImported);
    });
  });

  describe('listTitles', () => {
    it('retourne une liste paginée avec filtres', async () => {
      const mockData = [{ id: '1', titre_vo: 'Test' }];
      prismaServiceMock.titles.findMany.mockResolvedValue(mockData);
      prismaServiceMock.titles.count.mockResolvedValue(1);

      const result = await service.listTitles({
        type: 'film',
        page: 1,
        limit: 20,
        sort_by: 'date_sortie',
        sort_order: 'desc',
      });

      expect(result.data).toEqual(mockData);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('applique les filtres genre_id et country_id', async () => {
      prismaServiceMock.titles.findMany.mockResolvedValue([]);
      prismaServiceMock.titles.count.mockResolvedValue(0);

      await service.listTitles({
        genre_id: 'genre-1',
        country_id: 'country-1',
        is_animation: true,
        note_imdb_min: 7,
      });

      expect(prismaServiceMock.titles.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            title_genres: { some: { genre_id: 'genre-1' } },
            title_countries: { some: { country_id: 'country-1' } },
            is_animation: true,
            note_imdb: { gte: 7 },
          }),
        }),
      );
    });
  });

  describe('getRecommendations', () => {
    it('retourne les recommandations locales si présentes', async () => {
      const mockTitle = { id: '1', tmdb_id: 123, type: 'film' };
      const mockRecs = [
        { titles_title_recommendations_recommended_idTotitles: { id: '2', titre_vo: 'Rec' } },
      ];
      prismaServiceMock.titles.findUnique.mockResolvedValue(mockTitle);
      prismaServiceMock.title_recommendations.findMany.mockResolvedValue(mockRecs);

      const result = await service.getRecommendations('1');

      expect(result).toEqual([{ id: '2', titre_vo: 'Rec' }]);
    });

    it('fait fallback TMDB si pas de recommandations locales', async () => {
      const mockTitle = { id: '1', tmdb_id: 123, type: 'film' };
      prismaServiceMock.titles.findUnique.mockResolvedValue(mockTitle);
      prismaServiceMock.title_recommendations.findMany.mockResolvedValue([]);
      (getMovieRecommendations as jest.Mock).mockResolvedValue({ results: [{ id: 999, title: 'TMDB Rec' }] });
      (getMovieSimilar as jest.Mock).mockResolvedValue({ results: [] });
      prismaServiceMock.titles.findUnique.mockResolvedValueOnce(mockTitle);
      prismaServiceMock.titles.findUnique.mockResolvedValueOnce(null);

      const result = await service.getRecommendations('1');

      expect(getMovieRecommendations).toHaveBeenCalledWith(123);
      expect(result).toHaveLength(1);
      expect(result[0].tmdb_id).toBe(999);
    });

    it('lève NotFoundException si le titre n’existe pas', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue(null);

      await expect(service.getRecommendations('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('refreshTitle', () => {
    it('appelle refreshTitleData si le titre a un tmdb_id', async () => {
      const mockTitle = { id: '1', tmdb_id: 123 };
      prismaServiceMock.titles.findUnique.mockResolvedValue(mockTitle);
      (refreshTitleData as jest.Mock).mockResolvedValue({ id: '1', titre_vo: 'Refreshed' });

      const result = await service.refreshTitle('1');

      expect(refreshTitleData).toHaveBeenCalledWith('1');
      expect(result.titre_vo).toBe('Refreshed');
    });

    it('lève BadRequestException si le titre n’a pas de tmdb_id', async () => {
      const mockTitle = { id: '1', tmdb_id: null };
      prismaServiceMock.titles.findUnique.mockResolvedValue(mockTitle);

      await expect(service.refreshTitle('1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteIfOrphan', () => {
    it('supprime le titre s’il est orphelin', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: '1' });
      prismaServiceMock.user_ratings.count.mockResolvedValue(0);
      prismaServiceMock.user_watches.count.mockResolvedValue(0);
      prismaServiceMock.list_items.count.mockResolvedValue(0);
      prismaServiceMock.titles.delete.mockResolvedValue({});

      await service.deleteIfOrphan('1');

      expect(prismaServiceMock.titles.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('lève BadRequestException si le titre a des références', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: '1' });
      prismaServiceMock.user_ratings.count.mockResolvedValue(2);
      prismaServiceMock.user_watches.count.mockResolvedValue(0);
      prismaServiceMock.list_items.count.mockResolvedValue(0);

      await expect(service.deleteIfOrphan('1')).rejects.toThrow(BadRequestException);
      expect(prismaServiceMock.titles.delete).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si le titre n’existe pas', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue(null);

      await expect(service.deleteIfOrphan('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
