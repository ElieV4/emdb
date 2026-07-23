import { IsOptional, IsString, Length, IsUrl } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(3, 30)
  pseudo?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  avatar_url?: string;
}
