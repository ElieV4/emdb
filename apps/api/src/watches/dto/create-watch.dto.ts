import { IsDate, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO pour la création d'un watch (visionnage).
 *
 * Validation : soit title_id, soit episode_id (pas les deux, pas aucun).
 * La validation de cohérence est effectuée dans le service.
 */
export class CreateWatchDto {
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  title_id?: string;

  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  episode_id?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date_vue?: Date;
}
