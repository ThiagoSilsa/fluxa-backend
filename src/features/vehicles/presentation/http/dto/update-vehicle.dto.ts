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
 * Body de atualização de veículo (apresentação) — parcial: só os campos
 * enviados mudam. `isBlocked` é declarado apenas para ser **rejeitado**
 * (derivado — ADR 0006 §4).
 */
export class UpdateVehicleDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePlate(value) : value,
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  plate?: string;

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

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  vehicleTypeId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Derivado do bloqueio — rejeitado no use case (400).
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}
