import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaServiceMock = {
  notifications: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prismaServiceMock }],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  const userId = 'user-uuid';
  const notificationId = 'notif-uuid';
  const episodeId = 'episode-uuid';

  // ======================================================================
  // listNotifications
  // ======================================================================
  describe('listNotifications', () => {
    it('retourne la liste paginée, triée par non lues en priorité + created_at DESC', async () => {
      const mockData = [
        {
          id: notificationId,
          type: 'new_episode',
          lu: false,
          created_at: new Date('2026-07-24'),
          episodes: {
            id: episodeId,
            numero: 5,
            titre: 'Episode Test',
            season: { numero: 2 },
          },
        },
      ];
      prismaServiceMock.notifications.findMany.mockResolvedValue(mockData);
      prismaServiceMock.notifications.count.mockResolvedValue(1);

      const result = await service.listNotifications(userId, {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: notificationId,
        type: 'new_episode',
        lu: false,
        episode: {
          id: episodeId,
          numero: 5,
          titre: 'Episode Test',
        },
      });
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);

      expect(prismaServiceMock.notifications.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: userId },
          orderBy: [{ lu: 'asc' }, { created_at: 'desc' }],
          skip: 0,
          take: 20,
        }),
      );
    });

    it('retourne un tableau vide si aucune notification', async () => {
      prismaServiceMock.notifications.findMany.mockResolvedValue([]);
      prismaServiceMock.notifications.count.mockResolvedValue(0);

      const result = await service.listNotifications(userId, {});

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('applique correctement la pagination', async () => {
      prismaServiceMock.notifications.findMany.mockResolvedValue([]);
      prismaServiceMock.notifications.count.mockResolvedValue(0);

      await service.listNotifications(userId, { page: 2, limit: 10 });

      expect(prismaServiceMock.notifications.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  // ======================================================================
  // markAsRead
  // ======================================================================
  describe('markAsRead', () => {
    it('marque une notification comme lue', async () => {
      prismaServiceMock.notifications.findUnique.mockResolvedValue({
        id: notificationId,
        user_id: userId,
        lu: false,
      });
      prismaServiceMock.notifications.update.mockResolvedValue({});

      await service.markAsRead(notificationId, userId);

      expect(prismaServiceMock.notifications.update).toHaveBeenCalledWith({
        where: { id: notificationId },
        data: { lu: true },
      });
    });

    it("lève NotFoundException si la notification n'existe pas", async () => {
      prismaServiceMock.notifications.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead('nonexistent', userId)).rejects.toThrow(NotFoundException);
    });

    it('lève ForbiddenException si la notification appartient à un autre user', async () => {
      prismaServiceMock.notifications.findUnique.mockResolvedValue({
        id: notificationId,
        user_id: 'other-user',
        lu: false,
      });

      await expect(service.markAsRead(notificationId, userId)).rejects.toThrow(ForbiddenException);
    });
  });

  // ======================================================================
  // markAllAsRead
  // ======================================================================
  describe('markAllAsRead', () => {
    it("marque toutes les notifications de l'utilisateur comme lues", async () => {
      prismaServiceMock.notifications.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllAsRead(userId);

      expect(result).toEqual({ marked_count: 3 });
      expect(prismaServiceMock.notifications.updateMany).toHaveBeenCalledWith({
        where: { user_id: userId, lu: false },
        data: { lu: true },
      });
    });

    it('retourne 0 si aucune notification non lue', async () => {
      prismaServiceMock.notifications.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead(userId);

      expect(result).toEqual({ marked_count: 0 });
    });
  });

  // ======================================================================
  // getUnreadCount
  // ======================================================================
  describe('getUnreadCount', () => {
    it('retourne le nombre de notifications non lues', async () => {
      prismaServiceMock.notifications.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(userId);

      expect(result).toEqual({ count: 5 });
      expect(prismaServiceMock.notifications.count).toHaveBeenCalledWith({
        where: { user_id: userId, lu: false },
      });
    });

    it('retourne 0 si toutes les notifications sont lues', async () => {
      prismaServiceMock.notifications.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(userId);

      expect(result).toEqual({ count: 0 });
    });
  });
});
