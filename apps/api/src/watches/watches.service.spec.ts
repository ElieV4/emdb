import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WatchesService } from './watches.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@emdb/db', () => ({
  countEpisodesNonVus: jest.fn(),
  getSerieProgress: jest.fn(),
}));

import { countEpisodesNonVus, getSerieProgress } from '@emdb/db';

const prismaServiceMock = {
  titles: {
    findUnique: jest.fn(),
  },
  episodes: {
    findUnique: jest.fn(),
  },
  user_watches: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  user_follows_serie: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

describe('WatchesService', () => {
  let service: WatchesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WatchesService, { provide: PrismaService, useValue: prismaServiceMock }],
    }).compile();

    service = module.get<WatchesService>(WatchesService);
    jest.clearAllMocks();
  });

  const userId = 'user-uuid';
  const titleId = 'title-uuid';
  const episodeId = 'episode-uuid';
  const watchId = 'watch-uuid';

  // ======================================================================
  // createWatch
  // ======================================================================
  describe('createWatch', () => {
    it('crée un watch pour un title_id', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: titleId });
      prismaServiceMock.user_watches.create.mockResolvedValue({
        id: watchId,
        user_id: userId,
        title_id: titleId,
        episode_id: null,
        date_vue: new Date('2026-07-23'),
      });

      const result = await service.createWatch(userId, { title_id: titleId });

      expect(result.id).toBe(watchId);
      expect(prismaServiceMock.titles.findUnique).toHaveBeenCalledWith({
        where: { id: titleId },
        select: { id: true },
      });
      expect(prismaServiceMock.user_watches.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: userId,
            title_id: titleId,
            episode_id: null,
          }),
        }),
      );
    });

    it('crée un watch pour un episode_id', async () => {
      prismaServiceMock.episodes.findUnique.mockResolvedValue({ id: episodeId });
      prismaServiceMock.user_watches.create.mockResolvedValue({
        id: watchId,
        user_id: userId,
        title_id: null,
        episode_id: episodeId,
        date_vue: new Date('2026-07-23'),
      });

      const result = await service.createWatch(userId, { episode_id: episodeId });

      expect(result.id).toBe(watchId);
      expect(prismaServiceMock.episodes.findUnique).toHaveBeenCalledWith({
        where: { id: episodeId },
        select: { id: true },
      });
    });

    it('utilise la date personnalisée si fournie', async () => {
      const customDate = new Date('2025-12-25');
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: titleId });
      prismaServiceMock.user_watches.create.mockResolvedValue({
        id: watchId,
        date_vue: customDate,
      });

      await service.createWatch(userId, {
        title_id: titleId,
        date_vue: customDate,
      });

      expect(prismaServiceMock.user_watches.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            date_vue: customDate,
          }),
        }),
      );
    });

    it('utilise la date du jour par défaut', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: titleId });
      prismaServiceMock.user_watches.create.mockResolvedValue({ id: watchId });

      await service.createWatch(userId, { title_id: titleId });

      expect(prismaServiceMock.user_watches.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            date_vue: expect.any(Date),
          }),
        }),
      );
    });

    it('lève BadRequest si ni title_id ni episode_id', async () => {
      await expect(service.createWatch(userId, {})).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequest si les deux sont fournis', async () => {
      await expect(
        service.createWatch(userId, { title_id: titleId, episode_id: episodeId }),
      ).rejects.toThrow(BadRequestException);
    });

    it("lève NotFound si le title_id n'existe pas", async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue(null);

      await expect(service.createWatch(userId, { title_id: 'nonexistent' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lève NotFound si l'episode_id n'existe pas", async () => {
      prismaServiceMock.episodes.findUnique.mockResolvedValue(null);

      await expect(service.createWatch(userId, { episode_id: 'nonexistent' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ======================================================================
  // deleteWatch
  // ======================================================================
  describe('deleteWatch', () => {
    it('supprime un watch existant', async () => {
      prismaServiceMock.user_watches.findUnique.mockResolvedValue({
        id: watchId,
        user_id: userId,
      });
      prismaServiceMock.user_watches.delete.mockResolvedValue({});

      await service.deleteWatch(watchId, userId);

      expect(prismaServiceMock.user_watches.delete).toHaveBeenCalledWith({
        where: { id: watchId },
      });
    });

    it("lève NotFound si le watch n'existe pas", async () => {
      prismaServiceMock.user_watches.findUnique.mockResolvedValue(null);

      await expect(service.deleteWatch('nonexistent', userId)).rejects.toThrow(NotFoundException);
    });

    it('lève Forbidden si le watch appartient à un autre user', async () => {
      prismaServiceMock.user_watches.findUnique.mockResolvedValue({
        id: watchId,
        user_id: 'other-user',
      });

      await expect(service.deleteWatch(watchId, userId)).rejects.toThrow(ForbiddenException);
    });
  });

  // ======================================================================
  // listWatches
  // ======================================================================
  describe('listWatches', () => {
    it('retourne la liste paginée', async () => {
      const mockData = [{ id: watchId, title_id: titleId, date_vue: new Date() }];
      prismaServiceMock.user_watches.findMany.mockResolvedValue(mockData);
      prismaServiceMock.user_watches.count.mockResolvedValue(1);

      const result = await service.listWatches(userId, {});

      expect(result.data).toEqual(mockData);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('filtre par type', async () => {
      prismaServiceMock.user_watches.findMany.mockResolvedValue([]);
      prismaServiceMock.user_watches.count.mockResolvedValue(0);

      await service.listWatches(userId, { type: 'film' });

      expect(prismaServiceMock.user_watches.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            titles: { type: 'film' },
          }),
        }),
      );
    });

    it('filtre par date', async () => {
      prismaServiceMock.user_watches.findMany.mockResolvedValue([]);
      prismaServiceMock.user_watches.count.mockResolvedValue(0);

      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-12-31');

      await service.listWatches(userId, { date_from: dateFrom, date_to: dateTo });

      expect(prismaServiceMock.user_watches.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date_vue: { gte: dateFrom, lte: dateTo },
          }),
        }),
      );
    });
  });

  // ======================================================================
  // getSerieProgress
  // ======================================================================
  describe('getSerieProgress', () => {
    it('appelle getSerieProgress depuis @emdb/db', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({
        id: titleId,
        type: 'serie',
      });

      const mockProgress = [{ saison: 1, vus: 10, total: 12 }];
      (getSerieProgress as jest.Mock).mockResolvedValue(mockProgress);

      const result = await service.getSerieProgress(userId, titleId);

      expect(result).toEqual(mockProgress);
      expect(getSerieProgress).toHaveBeenCalledWith(userId, titleId);
    });

    it("lève NotFound si le titre n'existe pas", async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue(null);

      await expect(service.getSerieProgress(userId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lève BadRequest si le titre n'est pas une série", async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({
        id: titleId,
        type: 'film',
      });

      await expect(service.getSerieProgress(userId, titleId)).rejects.toThrow(BadRequestException);
    });
  });

  // ======================================================================
  // getCalendar
  // ======================================================================
  describe('getCalendar', () => {
    it('retourne le calendrier des épisodes non vus', async () => {
      const mockFollows = [
        {
          title_id: titleId,
          titles: {
            id: titleId,
            tmdb_id: 123,
            titre_vo: 'Serie Test',
            titre_vf: 'Série Test',
            affiche_url: '/poster.jpg',
            next_episode_air_date: new Date('2026-08-01'),
          },
        },
      ];
      prismaServiceMock.user_follows_serie.findMany.mockResolvedValue(mockFollows);
      (countEpisodesNonVus as jest.Mock).mockResolvedValue(5);

      const result = await service.getCalendar(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title_id: titleId,
        titre_vo: 'Serie Test',
        nb_non_vus: 5,
      });
      expect(countEpisodesNonVus).toHaveBeenCalledWith(userId, titleId);
    });

    it('retourne un tableau vide si aucune série suivie', async () => {
      prismaServiceMock.user_follows_serie.findMany.mockResolvedValue([]);

      const result = await service.getCalendar(userId);

      expect(result).toEqual([]);
    });

    it('trie par nb_non_vus décroissant', async () => {
      prismaServiceMock.user_follows_serie.findMany.mockResolvedValue([
        {
          title_id: 'serie-1',
          titles: {
            id: 'serie-1',
            titre_vo: 'Serie 1',
            titre_vf: null,
            affiche_url: null,
            next_episode_air_date: null,
          },
        },
        {
          title_id: 'serie-2',
          titles: {
            id: 'serie-2',
            titre_vo: 'Serie 2',
            titre_vf: null,
            affiche_url: null,
            next_episode_air_date: null,
          },
        },
      ]);
      (countEpisodesNonVus as jest.Mock).mockResolvedValueOnce(3).mockResolvedValueOnce(10);

      const result = await service.getCalendar(userId);

      expect(result[0].title_id).toBe('serie-2');
      expect(result[0].nb_non_vus).toBe(10);
      expect(result[1].title_id).toBe('serie-1');
      expect(result[1].nb_non_vus).toBe(3);
    });
  });

  // ======================================================================
  // follow
  // ======================================================================
  describe('follow', () => {
    it('suit une série existante', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({
        id: titleId,
        type: 'serie',
      });
      prismaServiceMock.user_follows_serie.create.mockResolvedValue({
        user_id: userId,
        title_id: titleId,
      });

      const result = await service.follow(userId, titleId);

      expect(result).toBeDefined();
      expect(prismaServiceMock.user_follows_serie.create).toHaveBeenCalledWith({
        data: { user_id: userId, title_id: titleId },
        include: expect.any(Object),
      });
    });

    it("lève NotFound si le titre n'existe pas", async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue(null);

      await expect(service.follow(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it("lève BadRequest si le titre n'est pas une série", async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({
        id: titleId,
        type: 'film',
      });

      await expect(service.follow(userId, titleId)).rejects.toThrow(BadRequestException);
    });
  });

  // ======================================================================
  // unfollow
  // ======================================================================
  describe('unfollow', () => {
    it('ne plus suivre une série', async () => {
      prismaServiceMock.user_follows_serie.findUnique.mockResolvedValue({
        user_id: userId,
        title_id: titleId,
      });
      prismaServiceMock.user_follows_serie.delete.mockResolvedValue({});

      await service.unfollow(userId, titleId);

      expect(prismaServiceMock.user_follows_serie.delete).toHaveBeenCalledWith({
        where: { user_id_title_id: { user_id: userId, title_id: titleId } },
      });
    });

    it("lève NotFound si la série n'est pas suivie", async () => {
      prismaServiceMock.user_follows_serie.findUnique.mockResolvedValue(null);

      await expect(service.unfollow(userId, titleId)).rejects.toThrow(NotFoundException);
    });
  });

  // ======================================================================
  // getFollowedSeries
  // ======================================================================
  describe('getFollowedSeries', () => {
    it('retourne la liste des séries suivies', async () => {
      const mockFollows = [
        {
          title_id: titleId,
          followed_at: new Date('2026-07-23'),
          titles: {
            id: titleId,
            tmdb_id: 123,
            titre_vo: 'Serie Test',
            titre_vf: null,
            affiche_url: null,
            type: 'serie',
            next_episode_air_date: null,
          },
        },
      ];
      prismaServiceMock.user_follows_serie.findMany.mockResolvedValue(mockFollows);

      const result = await service.getFollowedSeries(userId);

      expect(result).toHaveLength(1);
      expect(result[0].titre_vo).toBe('Serie Test');
      expect(result[0].followed_at).toBeDefined();
    });

    it('retourne un tableau vide si aucune série suivie', async () => {
      prismaServiceMock.user_follows_serie.findMany.mockResolvedValue([]);

      const result = await service.getFollowedSeries(userId);

      expect(result).toEqual([]);
    });
  });
});
