import { Controller, Get, Param } from '@nestjs/common';
import { CreditsService } from './credits.service';

/**
 * Contrôleur des endpoints credits (Phase 3.6).
 *
 * Endpoint :
 * - GET /titles/:titleId/credits — cast/crew groupés par rôle
 *
 * Les endpoints credits épisode et personne sont déjà disponibles :
 * - GET /episodes/:id/credits  → SeasonsEpisodesController (Phase 3.5)
 * - GET /people/:id/credits    → PeopleController (alias, Phase 3.4)
 * - GET /people/:id/filmography → PeopleService (Phase 3.4)
 */
@Controller()
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  /**
   * GET /titles/:titleId/credits
   * Retourne les crédits d'un titre, groupés par rôle.
   *
   * Cast (acteurs) triés par ordre.
   * Crew (réalisateurs, scénaristes, autres) groupés par rôle.
   */
  @Get('titles/:titleId/credits')
  async getTitleCredits(@Param('titleId') titleId: string) {
    return this.creditsService.getTitleCredits(titleId);
  }
}
