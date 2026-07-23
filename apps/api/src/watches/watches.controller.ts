import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WatchesService } from './watches.service';
import { CreateWatchDto } from './dto/create-watch.dto';
import { ListWatchesFilterDto } from './dto/list-watches-filter.dto';
import { FollowSerieDto } from './dto/follow-serie.dto';

/**
 * Contrôleur du module watches (Phase 4.1).
 *
 * Tous les endpoints nécessitent une authentification JWT.
 *
 * Endpoints :
 * - POST   /watches                  — marquer vu (titre ou épisode)
 * - DELETE /watches/:id              — supprimer un visionnage
 * - GET    /watches                  — liste paginée des visionnages
 * - GET    /titles/:titleId/progress — progression série (fn_progress_serie)
 * - GET    /calendar                 — calendrier épisodes non vus
 * - POST   /follows                  — suivre une série
 * - DELETE /follows/:titleId         — ne plus suivre
 * - GET    /follows                  — liste des séries suivies
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class WatchesController {
  constructor(private readonly watchesService: WatchesService) {}

  /**
   * POST /watches
   * Marque un titre ou un épisode comme vu.
   */
  @Post('watches')
  async createWatch(
    @CurrentUser() user: any,
    @Body() dto: CreateWatchDto,
  ) {
    return this.watchesService.createWatch(user.id, dto);
  }

  /**
   * DELETE /watches/:id
   * Supprime un visionnage (vérifie l'appartenance).
   */
  @Delete('watches/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWatch(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<void> {
    await this.watchesService.deleteWatch(id, user.id);
  }

  /**
   * GET /watches
   * Liste paginée des visionnages avec filtres optionnels.
   */
  @Get('watches')
  async listWatches(
    @CurrentUser() user: any,
    @Query() filters: ListWatchesFilterDto,
  ) {
    return this.watchesService.listWatches(user.id, filters);
  }

  /**
   * GET /titles/:titleId/progress
   * Progression de visionnage par saison pour une série.
   */
  @Get('titles/:titleId/progress')
  async getSerieProgress(
    @CurrentUser() user: any,
    @Param('titleId') titleId: string,
  ) {
    return this.watchesService.getSerieProgress(user.id, titleId);
  }

  /**
   * GET /calendar
   * Calendrier des épisodes non vus pour les séries suivies.
   */
  @Get('calendar')
  async getCalendar(@CurrentUser() user: any) {
    return this.watchesService.getCalendar(user.id);
  }

  /**
   * POST /follows
   * Suivre une série.
   */
  @Post('follows')
  async follow(
    @CurrentUser() user: any,
    @Body() dto: FollowSerieDto,
  ) {
    return this.watchesService.follow(user.id, dto.title_id);
  }

  /**
   * DELETE /follows/:titleId
   * Ne plus suivre une série.
   */
  @Delete('follows/:titleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfollow(
    @CurrentUser() user: any,
    @Param('titleId') titleId: string,
  ): Promise<void> {
    await this.watchesService.unfollow(user.id, titleId);
  }

  /**
   * GET /follows
   * Liste des séries suivies par l'utilisateur.
   */
  @Get('follows')
  async getFollowedSeries(@CurrentUser() user: any) {
    return this.watchesService.getFollowedSeries(user.id);
  }
}
