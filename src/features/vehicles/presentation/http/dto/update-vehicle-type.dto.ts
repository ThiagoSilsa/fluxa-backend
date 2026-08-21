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
 * Body de atualização de tipo de veículo (apresentação) — parcial: só os
 * campos enviados mudam.
 */
export class UpdateVehicleTypeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeCode(value) : value,
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isFleet?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
