import { IsNumber, IsOptional, IsString, IsInt } from 'class-validator';

export class CreateBillingRequestDto {
  @IsNumber() amount: number;
  @IsString() concept: string;

  /** Nuevo flujo basado en Área — excluye projectId/programaId. */
  @IsOptional() @IsInt() areaId?: number | null;

  /** Flujo legacy — se mantiene para compatibilidad. */
  @IsOptional() @IsInt() projectId?: number | null;
  @IsOptional() @IsInt() programaId?: number | null;

  @IsOptional() @IsString() draftInvoiceUrl?: string;
  @IsOptional() @IsString() createdBy?: string;
  @IsOptional() history?: any[];
}
