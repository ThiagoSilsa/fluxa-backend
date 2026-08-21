// class-validator
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// class-transformer
import { Transform } from 'class-transformer';

// Constants
import { MovementSource } from '../../../domain/constants/access.constant';

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

  /** Origem do registro (QRCODE/APP/MANUAL; default PLATE — M4). */
  @IsOptional()
  @IsEnum(MovementSource)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? (value.toUpperCase() as MovementSource)
      : (value as MovementSource | undefined),
  )
  source?: MovementSource;

  /** Portaria do device (validada ativa na empresa — M4). */
  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  entranceId?: string;
}
