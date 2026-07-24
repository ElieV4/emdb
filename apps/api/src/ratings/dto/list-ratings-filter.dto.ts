import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO pour filtrer et paginer la liste des notes de l'utilisateur.
 */
export class ListRatingsFilterDto {
  @IsOptional()
  @IsEnum(['film', 'serie'])
  type?: 'film' | 'serie';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
