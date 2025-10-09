import { IsDateString, IsEnum, IsNumber, IsString } from 'class-validator';

export class FinalInvoiceBodyDto {
  @IsString() number: string;
  @IsDateString() date: string; // yyyy-mm-dd
  @IsNumber() total: number;
  @IsEnum(['CRC','USD'] as any) currency: 'CRC'|'USD';
}
