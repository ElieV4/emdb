import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO pour GET /titles/search?q=&type=film|serie
 * Recherche un titre via TMDB + résultats locaux, fusionnés.
 */
export class SearchTitlesDto {
  @IsString()
  @IsNotEmpty()
  q!: string;

  @IsOptional()
  @IsEnum(['film', 'serie'])
  type?: 'film' | 'serie';
}
