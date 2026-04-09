import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug 只能包含小写字母、数字和连字符' })
  @MaxLength(200)
  slug: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  cover?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tagIds?: number[];
}
