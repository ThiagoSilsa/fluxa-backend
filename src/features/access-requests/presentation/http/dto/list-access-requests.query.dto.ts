// class-transformer
import { Transform, Type } from 'class-transformer';

// class-validator
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Constants
import { AccessRequestStatus } from '../../../domain/constants/access-request.constant';

/**
 * Query de listagem de solicitações de acesso (apresentação).
 */
export class ListAccessRequestsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
    return value;
  })
  @IsEnum(AccessRequestStatus)
  status?: AccessRequestStatus;

  @IsOptional()
  @IsString()
  plate?: string;

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
