import { IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/**
 * DTO pour l'upsert d'une note (PUT /ratings).
 *
 * Validation :
 * - Soit title_id, soit episode_id (pas les deux, pas aucun) — vérifié dans le service
 * - note_perso optionnel, entre 0 et 10
 * - commentaire optionnel, max 2000 caractères
 */
export class UpsertRatingDto {
  @IsOptional()
  @IsUUID()
  title_id?: string;

  @IsOptional()
  @IsUUID()
  episode_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  note_perso?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commentaire?: string;
}
