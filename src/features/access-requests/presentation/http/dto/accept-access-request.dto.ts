// class-validator
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

// Shared
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * Body de aceite de solicitação de acesso (apresentação — administração).
 */
export class AcceptAccessRequestDto {
  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  vehicleTypeId?: string;

  @IsOptional()
  @IsBoolean()
  canDrive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  observation?: string;
}
