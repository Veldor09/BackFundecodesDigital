import { IsDateString, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateVisitacionDto {
  /** Fecha de la visita en formato ISO-8601 (YYYY-MM-DD) */
  @IsDateString()
  fecha: string;

  /** Total de personas que visitaron */
  @IsInt()
  @Min(0)
  totalPersonas: number;

  /** Cantidad de visitantes nacionales */
  @IsInt()
  @Min(0)
  nacionales: number;

  /** Distribución de extranjeros por país: { "Costa Rica": 3, "Nicaragua": 2 } */
  @IsOptional()
  @IsObject()
  paisesExtranjeros?: Record<string, number>;

  /** Observaciones adicionales (opcional) */
  @IsOptional()
  @IsString()
  notas?: string;
}
