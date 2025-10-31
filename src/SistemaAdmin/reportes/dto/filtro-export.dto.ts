import { FiltroInformeDto } from './filtro-informe.dto';
import { IsEnum } from 'class-validator';

export enum TipoFormato {
  PDF = 'pdf',
  EXCEL = 'excel',
}

export class FiltroExportDto extends FiltroInformeDto {
  @IsEnum(TipoFormato, {
    message: 'El formato debe ser "pdf" o "excel".',
  })
  formato!: TipoFormato;
}
