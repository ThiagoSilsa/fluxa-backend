// class-transformer
import { Type } from 'class-transformer';

// class-validator
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

// Constants
import { ImportJobType } from '../../../domain/constants/import-job.constant';

/**
 * Query de listagem de jobs de importação (apresentação).
 */
export class ListImportJobsQueryDto {
  @IsOptional()
  @IsEnum(ImportJobType)
  type?: ImportJobType;

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
