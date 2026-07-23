import { Controller, Post, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

/**
 * Contrôleur admin – Phase 6.2
 *
 * Endpoints d'administration, réservés aux utilisateurs listés dans
 * ADMIN_EMAILS (fichier .env).
 *
 * Endpoints :
 * - POST /admin/refresh-materialized-views → déclenchement manuel du refresh
 */
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminService: AdminService) {}

  /**
   * POST /admin/refresh-materialized-views
   *
   * Déclenche manuellement le rafraîchissement des 8 vues matérialisées
   * via un job BullMQ ajouté à la queue `tmdb-cron` (déjà existante dans le worker).
   *
   * @returns jobId et status
   */
  @Post('refresh-materialized-views')
  async refreshMaterializedViews() {
    this.logger.log('Déclenchement manuel du refresh des vues matérialisées');
    return this.adminService.refreshMaterializedViews();
  }
}

