import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { SeasonsEpisodesService } from './seasons-episodes.service';

/**
 * Contrôleur des endpoints seasons-episodes (Phase 3.5).
 *
 * Endpoints :
 * - GET /titles/:titleId/seasons           — liste des saisons
 * - GET /titles/:titleId/seasons/:numero   — détail saison + épisodes
 * - GET /episodes/:id                      — détail épisode
 * - GET /episodes/:id/credits              — credits spécifiques épisode
 *
 * Tous ces endpoints sont publics (user-agnostic, pure lecture du catalogue).
 */
@Controller()
export class SeasonsEpisodesController {
  constructor(private readonly seasonsEpisodesService: SeasonsEpisodesService) {}

  /**
   * GET /titles/:titleId/seasons
   * Liste des saisons d'un titre (triées par numero).
   */
  @Get('titles/:titleId/seasons')
  async listSeasons(@Param('titleId') titleId: string) {
    return this.seasonsEpisodesService.listSeasons(titleId);
  }

  /**
   * GET /titles/:titleId/seasons/:numero
   * Détail d'une saison avec la liste de ses épisodes.
   */
  @Get('titles/:titleId/seasons/:numero')
  async getSeason(
    @Param('titleId') titleId: string,
    @Param('numero', ParseIntPipe) numero: number,
  ) {
    return this.seasonsEpisodesService.getSeason(titleId, numero);
  }

  /**
   * GET /episodes/:id
   * Détail d'un épisode avec les infos de sa saison parente.
   */
  @Get('episodes/:id')
  async getEpisode(@Param('id') id: string) {
    return this.seasonsEpisodesService.getEpisode(id);
  }

  /**
   * GET /episodes/:id/credits
   * Credits spécifiques à l'épisode (guest stars, crew d'épisode).
   * Retourne un objet groupé par rôle (ex: { Acteur: [...], Réalisateur: [...] }).
   */
  @Get('episodes/:id/credits')
  async getEpisodeCredits(@Param('id') id: string) {
    return this.seasonsEpisodesService.getEpisodeCredits(id);
  }
}
