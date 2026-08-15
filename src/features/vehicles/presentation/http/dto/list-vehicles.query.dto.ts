// class-transformer
import { Transform, Type } from 'class-transformer';

// class-validator
import {
  IsBoolean,
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
