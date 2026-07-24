import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Item du tableau de réordonnancement.
 */
export class ReorderItem {
  @IsUUID()
  title_id!: string;

  @IsInt()
  @Min(0)
  position!: number;
}

/**
 * DTO pour le réordonnancement batch des items d'une liste
 * (PATCH /lists/:listId/items/reorder).
 *
 * Validation :
 * - items : tableau non vide de ReorderItem
 * - Chaque item doit avoir un title_id valide et une position >= 0
 */
export class ReorderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items!: ReorderItem[];
}
