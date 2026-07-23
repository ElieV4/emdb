import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO pour la création d'une liste (POST /lists).
 *
 * Validation :
 * - nom : obligatoire, max 100 caractères
 * - type : enum ['watchlist', 'favoris', 'custom']
 * - description : optionnelle, max 500 caractères
 */
export class CreateListDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom!: string;

  @IsEnum(['watchlist', 'favoris', 'custom'])
  type!: 'watchlist' | 'favoris' | 'custom';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

