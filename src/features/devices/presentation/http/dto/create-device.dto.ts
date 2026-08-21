// class-validator
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Shared
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

// Constants
import { DevicePlatform } from '../../../domain/constants/device-platform.constant';

/**
 * Body de criação de dispositivo (apresentação).
 */
export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  entranceId?: string;
}
