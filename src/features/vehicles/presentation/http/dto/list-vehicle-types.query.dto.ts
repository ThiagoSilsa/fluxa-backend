// class-transformer
import { Transform, Type } from 'class-transformer';

// class-validator
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Query de listagem de tipos de veículo (apresentação).
 */
export class ListVehicleTypesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

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
  isFleet?: boolean;

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
