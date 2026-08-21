// class-transformer
import { Transform, Type } from 'class-transformer';

// class-validator
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

// Types
import type { DeviceSortBy } from '../../../domain/repositories/device.repository';

/**
 * Query de listagem de dispositivos (apresentação).
 */
export class ListDevicesQueryDto {
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
  isActive?: boolean;

  /** Coluna de ordenação (whitelist — ADR 0008 §5). */
  @IsOptional()
  @IsIn(['name', 'createdAt', 'lastSyncAt'])
  sortBy?: DeviceSortBy;

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
