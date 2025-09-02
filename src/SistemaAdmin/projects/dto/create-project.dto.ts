import { IsBoolean, IsDefined, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = (v: any) => (typeof v === 'string' ? v.trim() : v);

export class CreateProjectDto {
  @IsDefined({ message: 'title es requerido' })
  @IsString()
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'title no puede estar vacío' })
  title: string;

  // opcional: si no viene, se genera desde title + place
  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  slug?: string;

  @IsOptional() @IsString() @Transform(({ value }) => trim(value)) summary?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() @Transform(({ value }) => trim(value)) coverUrl?: string;

  // NOT NULL
  @IsDefined({ message: 'category es requerido' })
  @IsString()
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'category no puede estar vacío' })
  category: string;

  @IsDefined({ message: 'place es requerido' })
  @IsString()
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'place no puede estar vacío' })
  place: string;

  @IsDefined({ message: 'area es requerido' })
  @IsString()
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'area no puede estar vacío' })
  area: string;

  @IsOptional() @IsString() status?: 'EN_PROCESO' | 'FINALIZADO' | 'PAUSADO';
  @IsOptional() @IsBoolean() published?: boolean;
}
