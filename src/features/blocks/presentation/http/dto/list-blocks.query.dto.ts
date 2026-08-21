// class-transformer
import { Transform, Type } from 'class-transformer';

// class-validator
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Constants
import { VehicleBlockStatus } from '../../../domain/constants/block.constant';

/**
 * Query de listagem de bloqueios (apresentação).
 */
export class ListBlocksQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
    return value;
  })
  @IsEnum(VehicleBlockStatus)
  status?: VehicleBlockStatus;

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
