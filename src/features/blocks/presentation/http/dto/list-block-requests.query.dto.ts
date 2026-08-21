// class-transformer
import { Transform, Type } from 'class-transformer';

// class-validator
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

// Constants
import { BlockRequestStatus } from '../../../domain/constants/block.constant';

/**
 * Query de listagem de solicitações de bloqueio (apresentação).
 */
export class ListBlockRequestsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
    return value;
  })
  @IsEnum(BlockRequestStatus)
  status?: BlockRequestStatus;

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
