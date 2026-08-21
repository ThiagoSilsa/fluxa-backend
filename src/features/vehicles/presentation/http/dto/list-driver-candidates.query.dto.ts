// class-transformer
import { Type } from 'class-transformer';

// class-validator
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query de listagem de candidatos a motorista (apresentação).
 */
export class ListDriverCandidatesQueryDto {
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
