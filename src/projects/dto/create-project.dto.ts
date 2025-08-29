import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsString() title: string;
  @IsString() slug: string;

  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() coverUrl?: string;

  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() place?: string;
  @IsOptional() @IsString() area?: string;

  @IsOptional() @IsString() status?: 'EN_PROCESO' | 'FINALIZADO' | 'PAUSADO';
  @IsOptional() @IsBoolean() published?: boolean;
}
