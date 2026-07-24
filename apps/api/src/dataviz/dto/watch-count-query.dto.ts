import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * DTO pour GET /dataviz/watch-count
 *
 * @example
 * GET /dataviz/watch-count?groupBy=country
 * GET /dataviz/watch-count?groupBy=period&yearFrom=2023
 */
export class WatchCountQueryDto {
  @IsEnum(['genre', 'period', 'country', 'animation'])
  groupBy!: 'genre' | 'period' | 'country' | 'animation';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearTo?: number;
}
