// class-transformer
import { Type } from 'class-transformer';

// class-validator
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query de listagem de opções de veículo (apresentação).
 */
export class ListVehicleOptionsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

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
