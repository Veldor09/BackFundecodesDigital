import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(80)
  author: string;

  @IsString()
  @IsNotEmpty({ message: 'El comentario es obligatorio.' })
  @MaxLength(500)
  text: string;

  /** URL del adjunto (imagen/video) subido previamente al storage. Opcional. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  attachmentUrl?: string;

  /** Clave R2 del adjunto; se almacena para borrado posterior. Opcional. */
  @IsOptional()
  @IsString()
  attachmentKey?: string;
}
