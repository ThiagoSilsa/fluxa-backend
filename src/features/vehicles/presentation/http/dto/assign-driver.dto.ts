// class-validator
import { IsBoolean, IsOptional, Matches } from 'class-validator';

// Shared
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * Body de atribuição de motorista a veículo (POST — apresentação).
 */
export class AssignDriverDto {
  @Matches(UUID_ANY_VERSION_PATTERN)
  userId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  canDrive?: boolean;
}
