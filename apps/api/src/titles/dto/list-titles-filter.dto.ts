import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * DTO pour GET /titles — liste/pagination avec filtres.
 *
 * Filtres supportés :
 * - type : 'film' | 'serie'
 * - genre_id : UUID du genre (jointure title_genres)
 * - country_id : UUID du pays (jointure title_countries)
 * - is_animation : booléen
 * - note_imdb_min : note minimale (0-10)
 * - sort_by : 'date_sortie' | 'note_imdb'
 * - sort_order : 'asc' | 'desc'
 * - page / limit : pagination
 */
export class ListTitlesFilterDto {
  @IsOptional()
  @IsEnum(['film', 'serie'])
  type?: 'film' | 'serie';

  @IsOptional()
  @IsString()
  genre_id?: string;

  @IsOptional()
  @IsString()
  country_id?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_animation?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  note_imdb_min?: number;

  @IsOptional()
  @IsString()
  sort_by?: 'date_sortie' | 'note_imdb' = 'date_sortie';

  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
