// class-validator
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body de atualização de departamento (apresentação) — parcial: só os campos
 * enviados mudam.
 */
export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  parkingSpace?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
