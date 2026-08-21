// class-transformer
import { Transform } from 'class-transformer';

// class-validator
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Shared
import { normalizePlate } from '../../../../../shared/utils/plate.util';
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * Body de criação de veículo (apresentação).
 *
 * `plate` é normalizada (`trim` + `uppercase` + sem hífen/espaço) antes de
 * validar; o formato é validado no use case (400). `isBlocked` é declarado
 * apenas para ser **rejeitado** (derivado — ADR 0006 §4).
 */
export class CreateVehicleDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePlate(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  plate!: string;

  @Matches(UUID_ANY_VERSION_PATTERN)
  vehicleTypeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string;

  @IsOptional()
  @IsBoolean()
  freePass?: boolean;

  // Derivado do bloqueio — rejeitado no use case (400).
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}
