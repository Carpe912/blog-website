import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CATALOG_NAME_MAX_LENGTH } from '../article-catalog';

export class PostMembershipDto {
  @IsOptional()
  @IsString()
  @MaxLength(CATALOG_NAME_MAX_LENGTH)
  series?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CATALOG_NAME_MAX_LENGTH)
  topic?: string | null;
}

export class CreatePostDto extends PostMembershipDto {
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

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => PostMembershipDto)
  memberships?: PostMembershipDto[];

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
