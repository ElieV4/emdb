import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RatingsService } from './ratings.service';
import { UpsertRatingDto } from './dto/upsert-rating.dto';
import { ListRatingsFilterDto } from './dto/list-ratings-filter.dto';

/**
 * Contrôleur du module ratings (Phase 4.2).
 *
 * Endpoints :
 * - PUT    /ratings              — Créer ou mettre à jour une note (auth)
 * - DELETE /ratings/:id          — Supprimer une note (auth)
 * - GET    /ratings              — Liste des notes de l'utilisateur (auth)
 * - GET    /titles/:id/ratings   — Résumé public des notes d'un titre (public)
 */
@Controller()
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  /**
   * PUT /ratings
   * Crée ou met à jour une note (upsert via contrainte UNIQUE).
   */
  @UseGuards(JwtAuthGuard)
  @Put('ratings')
  async upsertRating(@CurrentUser() user: any, @Body() dto: UpsertRatingDto) {
    return this.ratingsService.upsertRating(user.id, dto);
  }

  /**
   * DELETE /ratings/:id
   * Supprime une note (vérifie l'appartenance).
   */
  @UseGuards(JwtAuthGuard)
  @Delete('ratings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRating(@CurrentUser() user: any, @Param('id') id: string): Promise<void> {
    await this.ratingsService.deleteRating(id, user.id);
  }

  /**
   * GET /ratings
   * Liste paginée des notes de l'utilisateur connecté, filtrée par type.
   */
  @UseGuards(JwtAuthGuard)
  @Get('ratings')
  async listUserRatings(@CurrentUser() user: any, @Query() filters: ListRatingsFilterDto) {
    return this.ratingsService.listUserRatings(user.id, filters);
  }

  /**
   * GET /titles/:id/ratings
   * Résumé public des notes d'un titre (moyenne, count, répartition).
   * Accessible sans authentification.
   */
  @Get('titles/:id/ratings')
  async getTitleRatingsSummary(@Param('id') id: string) {
    return this.ratingsService.getTitleRatingsSummary(id);
  }
}
