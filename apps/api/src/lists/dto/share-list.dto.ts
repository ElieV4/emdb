import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';

/**
 * DTO pour le partage d'une liste (POST /lists/:listId/shares).
 *
 * Validation :
 * - shared_with_user_id : UUID obligatoire
 * - permission : enum ['lecture', 'edition']
 */
export class ShareListDto {
  @IsUUID()
  @IsNotEmpty()
  shared_with_user_id!: string;

  @IsEnum(['lecture', 'edition'])
  permission!: 'lecture' | 'edition';
}
