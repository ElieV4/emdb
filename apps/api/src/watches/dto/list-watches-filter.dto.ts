import { IsDate, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO pour filtrer et paginer la liste des visionnages.
 */
export class ListWatchesFilterDto {
  @IsOptional()
  @IsEnum(['film', 'serie'])
  type?: 'film' | 'serie';

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date_from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date_to?: Date;

  @IsOptional()
  @IsUUID()
  title_id?: string;

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
