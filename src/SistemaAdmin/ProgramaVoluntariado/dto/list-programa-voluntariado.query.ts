import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListProgramaVoluntariadoQuery {
  @ApiPropertyOptional({ example: 'reforestación' })
  @IsOptional()
  @IsString()
  search?: string;
}