import { IsNotEmpty, IsUUID } from 'class-validator';

/**
 * DTO pour suivre une série.
 */
export class FollowSerieDto {
  @IsUUID()
  @IsNotEmpty()
  title_id!: string;
}
