import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsInt() requestId: number;

  /**
   * projectId es opcional: cuando la solicitud original era para un
   * PROGRAMA, el front no lo envía y el back lo deriva del BillingRequest
   * asociado (que ya tiene el projectId resuelto).
   */
  @IsOptional()
  @IsInt()
  projectId?: number;

  @IsDateString() date: string;
  @IsNumber() amount: number;
  @IsEnum(['CRC','USD'] as any) currency: 'CRC'|'USD';
  @IsString() reference: string;
}
