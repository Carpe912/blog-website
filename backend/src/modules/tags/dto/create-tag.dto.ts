import { IsString, IsNotEmpty, Matches, MinLength, MaxLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug 只能包含小写字母、数字和连字符' })
  slug: string;
}
