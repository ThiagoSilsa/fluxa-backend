// class-validator
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Shared
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * Body de registro de saída (apresentação).
 */
export class RegisterExitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  plate!: string;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  driverUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  temporaryDriverName?: string;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  idempotencyKey?: string;
}
