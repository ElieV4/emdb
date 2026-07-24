import { Test, TestingModule } from '@nestjs/testing';
import { DatavizService } from './dataviz.service';
import { PrismaService } from '../prisma/prisma.service';
import { WatchTimeQueryDto } from './dto/watch-time-query.dto';
import { WatchCountQueryDto } from './dto/watch-count-query.dto';

const mockPrismaService = {
  $queryRawUnsafe: jest.fn(),
};

describe('DatavizService', () => {
  let service: DatavizService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatavizService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<DatavizService>(DatavizService);
    jest.clearAllMocks();
  });

  const userId = 'user-uuid';

  describe('getWatchTime', () => {
    it('retourne les données groupées par période', async () => {
      const mockData = [{ user_id: userId, periode_semaine: new Date('2024-01-01'), minutes: 120 }];
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockData);

      const result = await service.getWatchTime(userId, {
        groupBy: 'period',
      } as WatchTimeQueryDto);

      expect(result).toEqual(mockData);
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('mv_watch_time_by_period'),
      );
    });

    it('filtre par année pour period', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      await service.getWatchTime(userId, {
        groupBy: 'period',
        yearFrom: 2024,
        yearTo: 2025,
      } as WatchTimeQueryDto);

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('EXTRACT(YEAR FROM periode_semaine) BETWEEN 2024 AND 2025'),
      );
    });

    it('retourne les données groupées par genre', async () => {
      const mockData = [{ user_id: userId, genre_id: 'genre-uuid', minutes: 200 }];
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockData);

      const result = await service.getWatchTime(userId, {
        groupBy: 'genre',
      } as WatchTimeQueryDto);

      expect(result).toEqual(mockData);
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('mv_watch_time_by_genre'),
      );
    });

    it('filtre par année pour genre (sous-requête EXISTS)', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      await service.getWatchTime(userId, {
        groupBy: 'genre',
        yearFrom: 2023,
      } as WatchTimeQueryDto);

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('EXISTS'),
      );
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('AND EXTRACT(YEAR FROM uw.date_vue) BETWEEN 2023 AND 2100'),
      );
    });

    it('retourne les données groupées par pays', async () => {
      const mockData = [{ user_id: userId, country_id: 'country-uuid', minutes: 150 }];
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockData);

      const result = await service.getWatchTime(userId, {
        groupBy: 'country',
      } as WatchTimeQueryDto);

      expect(result).toEqual(mockData);
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('mv_watch_time_by_country'),
      );
    });

    it('retourne les données groupées par animation', async () => {
      const mockData = [{ user_id: userId, is_animation: true, minutes: 300 }];
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockData);

      const result = await service.getWatchTime(userId, {
        groupBy: 'animation',
      } as WatchTimeQueryDto);

      expect(result).toEqual(mockData);
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('mv_watch_time_by_animation'),
      );
    });

    it('retourne un tableau vide si la vue est vide', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.getWatchTime(userId, {
        groupBy: 'period',
      } as WatchTimeQueryDto);

      expect(result).toEqual([]);
    });
  });

  describe('getWatchCount', () => {
    it('retourne les données groupées par période', async () => {
      const mockData = [{ user_id: userId, periode_semaine: new Date('2024-01-01'), nb_items: 5 }];
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockData);

      const result = await service.getWatchCount(userId, {
        groupBy: 'period',
      } as WatchCountQueryDto);

      expect(result).toEqual(mockData);
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('mv_watch_count_by_period'),
      );
    });

    it('filtre par année pour period', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      await service.getWatchCount(userId, {
        groupBy: 'period',
        yearTo: 2024,
      } as WatchCountQueryDto);

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('EXTRACT(YEAR FROM periode_semaine) BETWEEN 1900 AND 2024'),
      );
    });

    it('retourne les données groupées par genre', async () => {
      const mockData = [{ user_id: userId, genre_id: 'genre-uuid', nb_items: 10 }];
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockData);

      const result = await service.getWatchCount(userId, {
        groupBy: 'genre',
      } as WatchCountQueryDto);

      expect(result).toEqual(mockData);
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('mv_watch_count_by_genre'),
      );
    });

    it('retourne les données groupées par pays', async () => {
      const mockData = [{ user_id: userId, country_id: 'country-uuid', nb_items: 3 }];
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockData);

      const result = await service.getWatchCount(userId, {
        groupBy: 'country',
      } as WatchCountQueryDto);

      expect(result).toEqual(mockData);
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('mv_watch_count_by_country'),
      );
    });

    it('retourne les données groupées par animation', async () => {
      const mockData = [{ user_id: userId, is_animation: false, nb_items: 7 }];
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockData);

      const result = await service.getWatchCount(userId, {
        groupBy: 'animation',
      } as WatchCountQueryDto);

      expect(result).toEqual(mockData);
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('mv_watch_count_by_animation'),
      );
    });

    it('retourne un tableau vide si la vue est vide', async () => {
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      const result = await service.getWatchCount(userId, {
        groupBy: 'country',
      } as WatchCountQueryDto);

      expect(result).toEqual([]);
    });
  });

  describe('sécurité ORDER BY', () => {
    it("n'ajoute que les colonnes autorisées dans le ORDER BY", async () => {
      const mockService = service as any;

      expect(mockService.orderBy('periode_semaine')).toBe(' ORDER BY periode_semaine');
      expect(mockService.orderBy('genre_id')).toBe(' ORDER BY genre_id');
      expect(mockService.orderBy('country_id')).toBe(' ORDER BY country_id');
      expect(mockService.orderBy('is_animation')).toBe(' ORDER BY is_animation');
      expect(mockService.orderBy('invalid_col; DROP TABLE users;')).toBe('');
    });
  });
});
