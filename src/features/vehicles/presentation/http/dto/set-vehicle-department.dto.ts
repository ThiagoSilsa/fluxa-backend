// class-validator
import { Matches } from 'class-validator';

// Shared
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * Body de definição do departamento padrão do veículo (PUT — apresentação).
 */
export class SetVehicleDepartmentDto {
  @Matches(UUID_ANY_VERSION_PATTERN)
  departmentId!: string;
}
