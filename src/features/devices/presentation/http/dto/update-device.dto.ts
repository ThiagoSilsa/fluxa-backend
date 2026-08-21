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
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * Body de atualização de dispositivo (apresentação) — parcial: só os campos
 * enviados mudam.
 *
 * `entranceId` aceita `null` para **desvincular** a portaria (ADR 0008 §4).
 */
export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  entranceId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
