import { IsEnum, IsInt, Min } from 'class-validator';

/**
 * DTO pour déclencher un import TMDB d'un titre.
 * Utilisé en interne par le endpoint GET /titles/tmdb/:tmdbId.
 */
export class ImportTitleDto {
  @IsInt()
  @Min(1)
  tmdb_id!: number;

  @IsEnum(['film', 'serie'])
  type!: 'film' | 'serie';
}
