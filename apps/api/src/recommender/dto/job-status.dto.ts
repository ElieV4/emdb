import { IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';

export class JobResultDto {
  titles_computed!: number;
  people_computed!: number;
}

export class JobStatusResponse {
  @IsString()
  jobId!: string;

  @IsEnum(['waiting', 'active', 'completed', 'failed', 'delayed'])
  status!: string;

  @IsOptional()
  result?: JobResultDto;

  @IsOptional()
  @IsNumber()
  progress?: number;

  @IsOptional()
  @IsNumber()
  duration_ms?: number;
}
