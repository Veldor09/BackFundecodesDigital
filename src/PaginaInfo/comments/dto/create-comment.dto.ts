import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(80)
  author: string;

  @IsString()
  @IsNotEmpty({ message: 'El comentario es obligatorio.' })
  @MaxLength(500)
  text: string;
}
