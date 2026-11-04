import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  /**
   * 可选：留空时由后端根据标题自动生成随机 slug
   */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug 只能包含小写字母、数字和连字符' })
  @MaxLength(200)
  slug?: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  /**
   * 可选：留空时由模型根据正文自动生成
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
