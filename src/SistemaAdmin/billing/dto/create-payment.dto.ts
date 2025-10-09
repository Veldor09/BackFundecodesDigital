import { IsDateString, IsEnum, IsInt, IsNumber, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsInt() requestId: number;
  @IsInt() projectId: number;
  @IsDateString() date: string;
  @IsNumber() amount: number;
  @IsEnum(['CRC','USD'] as any) currency: 'CRC'|'USD';
  @IsString() reference: string;
}
