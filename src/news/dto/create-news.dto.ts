import { IsBoolean, IsOptional, IsString } from 'class-validator';
export class CreateNewsDto {
  @IsString() title!: string;
  @IsString() slug!: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() coverUrl?: string;
  @IsOptional() @IsBoolean() published?: boolean;
}
