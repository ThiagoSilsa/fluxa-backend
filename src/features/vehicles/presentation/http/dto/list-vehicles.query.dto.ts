// class-transformer
import { Transform, Type } from 'class-transformer';

// class-validator
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

// Shared
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * Query de listagem de veículos (apresentação).
 */
export class ListVehiclesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  vehicleTypeId?: string;

  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  departmentId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  freePass?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  /** Coluna de ordenação (whitelist — ADR 0006 §11). */
  @IsOptional()
  @IsIn(['plate', 'isActive', 'createdAt'])
  sortBy?: 'plate' | 'isActive' | 'createdAt';

  /** Direção da ordenação. */
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
