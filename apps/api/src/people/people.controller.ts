import { Controller, Get, Param, Patch, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PeopleService } from './people.service';
import { SearchPeopleDto } from './dto/search-people.dto';

/**
 * Contrôleur des endpoints people (Phase 3.4).
 *
 * Endpoints :
 * - GET    /people/search?q=         — recherche TMDB + local fusionnée
 * - GET    /people/tmdb/:tmdbId      — get or import par TMDB ID
 * - GET    /people/:id               — détail complet d'une personne
 * - GET    /people/:id/filmography   — filmographie groupée par rôle
 * - GET    /people/:id/recommendations — recommandations
 * - PATCH  /people/:id/refresh       — rafraîchissement TMDB (authentifié)
 */
@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  /**
   * GET /people/search?q=
   * Recherche une personne via TMDB + résultats locaux, fusionnés.
   */
  @Get('search')
  async search(@Query() query: SearchPeopleDto) {
    return this.peopleService.search(query.q);
  }

  /**
   * GET /people/tmdb/:tmdbId
   * "Get or import" : cherche par tmdb_id, sinon déclenche l'import TMDB.
   */
  @Get('tmdb/:tmdbId')
  async getOrImport(@Param('tmdbId') tmdbId: string) {
    const id = parseInt(tmdbId, 10);
    if (isNaN(id) || id < 1) {
      throw new NotFoundException('ID TMDB invalide.');
    }
    return this.peopleService.getOrImportByTmdbId(id);
  }

  /**
   * GET /people/:id
   * Détail complet d'une personne (bio, photo, wiki_url, pays, etc.).
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.peopleService.getById(id);
  }

  /**
   * GET /people/:id/credits
   * Alias de filmography pour la cohérence des routes (Phase 3.6).
   * Retourne les credits → titles, groupés par rôle, triés par date de sortie.
   */
  @Get(':id/credits')
  async getCredits(@Param('id') id: string) {
    return this.peopleService.getFilmography(id);
  }

  /**
   * GET /people/:id/filmography
   * Filmographie d'une personne : credits → titles, groupée par rôle,
   * triée par date de sortie.
   */
  @Get(':id/filmography')
  async getFilmography(@Param('id') id: string) {
    return this.peopleService.getFilmography(id);
  }

  /**
   * GET /people/:id/recommendations
   * Recommandations d'une personne (person_recommendations).
   */
  @Get(':id/recommendations')
  async getRecommendations(@Param('id') id: string) {
    return this.peopleService.getRecommendations(id);
  }

  /**
   * PATCH /people/:id/refresh
   * Rafraîchit les données d'une personne depuis TMDB.
   * Nécessite une authentification JWT.
   */
  @Patch(':id/refresh')
  @UseGuards(JwtAuthGuard)
  async refresh(@Param('id') id: string) {
    return this.peopleService.refresh(id);
  }
}
