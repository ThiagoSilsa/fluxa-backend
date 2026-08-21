// class-transformer
import { Transform } from 'class-transformer';

// class-validator
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Shared
import { normalizeCode } from '../../../../../shared/utils/code.util';

/**
 * Body de criação de tipo de veículo (apresentação).
 *
 * `code` é normalizado (`trim` + `uppercase`) antes de validar — o unique
 * `(company_id, code)` do Postgres é case-sensitive (ADR 0006 §6).
 */
export class CreateVehicleTypeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeCode(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isFleet?: boolean;
}
