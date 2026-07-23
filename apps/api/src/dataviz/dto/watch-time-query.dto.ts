import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * DTO pour GET /dataviz/watch-time
 *
 * @example
 * GET /dataviz/watch-time?groupBy=genre
 * GET /dataviz/watch-time?groupBy=period&yearFrom=2024&yearTo=2025
 */
export class WatchTimeQueryDto {
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
