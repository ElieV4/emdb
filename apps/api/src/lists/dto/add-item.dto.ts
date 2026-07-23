import { IsNotEmpty, IsUUID } from 'class-validator';

/**
 * DTO pour l'ajout d'un titre à une liste (POST /lists/:listId/items).
 *
 * Validation :
 * - title_id : UUID obligatoire
 */
export class AddItemDto {
  @IsUUID()
  @IsNotEmpty()
  title_id!: string;
}

