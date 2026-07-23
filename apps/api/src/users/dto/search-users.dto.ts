import { IsNotEmpty, IsString } from 'class-validator';

export class SearchUsersDto {
  @IsString()
  @IsNotEmpty()
  query!: string;
}
