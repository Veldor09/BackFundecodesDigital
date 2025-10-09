import { IsEnum, IsOptional, IsString } from 'class-validator';

export class PatchBillingRequestDto {
  @IsOptional() @IsString() draftInvoiceUrl?: string;
  @IsOptional() history?: any[];
  @IsOptional() @IsString() comentarioContadora?: string;
  @IsOptional() @IsString() comentarioDirector?: string;
  @IsOptional() @IsString() status?: 'PENDING'|'VALIDATED'|'APPROVED'|'REJECTED'|'PAID';

  // Soporte para front: { finalInvoice: {...} } en PATCH /requests/:id
  @IsOptional() finalInvoice?: {
    number: string;
    date: string;
    total: number;
    currency: 'CRC' | 'USD';
    isValid?: boolean;
  };
}
