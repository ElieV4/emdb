import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO pour GET /people/search?q=
 * Recherche une personne via TMDB + résultats locaux, fusionnés.
 */
export class SearchPeopleDto {
  @IsString()
  @IsNotEmpty()
  q!: string;
}
