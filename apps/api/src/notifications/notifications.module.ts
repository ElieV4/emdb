import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * Module NestJS pour les notifications utilisateur (Phase 7.1).
 *
 * Fournit les endpoints de consultation et gestion des notifications :
 * - Liste paginée (non lues en priorité)
 * - Marquage individuel / collectif comme lu
 * - Compteur de notifications non lues
 *
 * @phase 7.1
 */
@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}