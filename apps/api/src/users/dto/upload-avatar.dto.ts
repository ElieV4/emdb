import { IsOptional, IsString, IsUrl } from 'class-validator';

/**
 * DTO pour la réponse du téléchargement d'avatar.
 * Le fichier est uploadé via multipart/form-data (multer),
 * mais la réponse renvoie simplement l'URL finale de l'avatar.
 */
export class UploadAvatarResponseDto {
  @IsString()
  avatar_url!: string;
}

/**
 * DTO optionnel pour fournir une URL d'avatar directement
 * (utile pour les tests ou les clients qui gèrent le stockage eux-mêmes).
 */
export class SetAvatarUrlDto {
  @IsOptional()
  @IsUrl()
  avatar_url?: string;
}
