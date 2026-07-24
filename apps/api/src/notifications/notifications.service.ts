import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListNotificationsFilterDto } from './dto/list-notifications-filter.dto';

/**
 * Service métier pour le module notifications (Phase 7.1).
 *
 * Gère :
 * - La consultation des notifications (liste paginée, non lues en priorité)
 * - Le marquage d'une notification comme lue
 * - Le marquage de toutes les notifications comme lues
 * - Le compteur de notifications non lues
 *
 * @phase 7.1
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste paginée des notifications de l'utilisateur.
   *
   * Les notifications non lues apparaissent en premier,
   * puis tri par date décroissante.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @param filters - Pagination (page, limit)
   * @returns Liste paginée des notifications
   */
  async listNotifications(userId: string, filters: ListNotificationsFilterDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = { user_id: userId };

    const [data, total] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        include: {
          episodes: {
            select: {
              id: true,
              numero: true,
              titre: true,
              seasons: {
                select: { numero: true },
              },
            },
          },
        },
        orderBy: [{ lu: 'asc' }, { created_at: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.notifications.count({ where }),
    ]);

    return {
      data: data.map((n) => ({
        id: n.id,
        type: n.type,
        lu: n.lu,
        created_at: n.created_at,
        episode: n.episodes,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Marque une notification spécifique comme lue.
   *
   * Vérifie que la notification existe et appartient à l'utilisateur.
   *
   * @param notificationId - UUID de la notification
   * @param userId - UUID de l'utilisateur connecté
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.prisma.notifications.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification introuvable.');
    }

    if (notification.user_id !== userId) {
      throw new ForbiddenException('Cette notification ne vous appartient pas.');
    }

    await this.prisma.notifications.update({
      where: { id: notificationId },
      data: { lu: true },
    });
  }

  /**
   * Marque toutes les notifications de l'utilisateur comme lues.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @returns Nombre de notifications marquées
   */
  async markAllAsRead(userId: string): Promise<{ marked_count: number }> {
    const result = await this.prisma.notifications.updateMany({
      where: { user_id: userId, lu: false },
      data: { lu: true },
    });

    return { marked_count: result.count };
  }

  /**
   * Compteur de notifications non lues pour l'utilisateur.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @returns Nombre de notifications non lues
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notifications.count({
      where: { user_id: userId, lu: false },
    });

    return { count };
  }
}
