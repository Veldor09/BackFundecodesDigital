// src/SistemaAdmin/cuentas/dto/update-cuenta.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCuentaDto } from './create-cuenta.dto';

/**
 * Todos los campos opcionales — la cuenta se puede actualizar parcialmente.
 * El cambio de `codigo` debe respetar la unicidad (lo valida el service).
 */
export class UpdateCuentaDto extends PartialType(CreateCuentaDto) {}
