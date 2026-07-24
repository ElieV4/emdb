import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';

/**
 * Module admin – Phase 6.2
 *
 * Regroupe les endpoints d'administration nécessitant un accès restreint
 * (vérifié par AdminGuard via ADMIN_EMAILS dans .env).
 *
 * Dépendances :
 * - ConfigModule : pour lire ADMIN_EMAILS et REDIS_URL
 *
 * Notes :
 * - bullmq et ioredis doivent être installés dans apps/api (package.json)
 * - AdminGuard dépend de JwtAuthGuard (composé via @UseGuards)
 */
@Module({
  imports: [ConfigModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
