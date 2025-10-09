import { IsEnum, IsNumber, IsOptional, IsString, IsInt } from 'class-validator';

export class CreateBillingRequestDto {
  @IsNumber() amount: number;
  @IsString() concept: string;
  @IsInt() projectId: number;

  @IsOptional() @IsString() draftInvoiceUrl?: string;
  @IsOptional() @IsString() createdBy?: string;
  @IsOptional() history?: any[];
}
