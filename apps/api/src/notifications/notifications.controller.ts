import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { ListNotificationsFilterDto } from './dto/list-notifications-filter.dto';

/**
 * Contrôleur du module notifications (Phase 7.1).
 *
 * Tous les endpoints nécessitent une authentification JWT.
 *
 * Endpoints :
 * - GET    /notifications                    — liste paginée des notifications
 * - PATCH  /notifications/:id/read           — marquer une notification comme lue
 * - PATCH  /notifications/read-all           — marquer toutes les notifications comme lues
 * - GET    /notifications/unread-count       — compteur de notifications non lues
 *
 * @phase 7.1
 */
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications
   * Liste paginée des notifications (non lues en priorité).
   */
  @Get()
  async listNotifications(
    @CurrentUser() user: any,
    @Query() filters: ListNotificationsFilterDto,
  ) {
    return this.notificationsService.listNotifications(user.id, filters);
  }

  /**
   * PATCH /notifications/:id/read
   * Marque une notification spécifique comme lue.
   */
  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.notificationsService.markAsRead(id, user.id);
    return { success: true };
  }

  /**
   * PATCH /notifications/read-all
   * Marque toutes les notifications de l'utilisateur comme lues.
   */
  @Patch('read-all')
  async markAllAsRead(
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; marked_count: number }> {
    const result = await this.notificationsService.markAllAsRead(user.id);
    return { success: true, marked_count: result.marked_count };
  }

  /**
   * GET /notifications/unread-count
   * Compteur de notifications non lues.
   */
  @Get('unread-count')
  async getUnreadCount(
    @CurrentUser() user: any,
  ): Promise<{ count: number }> {
    return this.notificationsService.getUnreadCount(user.id);
  }
}