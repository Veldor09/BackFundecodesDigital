import { IsEmail, IsString, MaxLength } from 'class-validator';
export class CreateContactDto {
  @IsString() @MaxLength(120) name!: string;
  @IsEmail() email!: string;
  @IsString() @MaxLength(2000) message!: string;
}
