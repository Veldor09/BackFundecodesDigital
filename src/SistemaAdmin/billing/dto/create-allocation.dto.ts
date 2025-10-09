import { IsDateString, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAllocationDto {
  @IsInt() projectId: number;
  @IsString() concept: string;
  @IsNumber() amount: number;
  @IsOptional() @IsDateString() date?: string; // opcional; default now
}
