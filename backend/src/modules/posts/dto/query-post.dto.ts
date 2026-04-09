import { IsOptional, IsBoolean, IsInt, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryPostDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  tagId?: number;
}
