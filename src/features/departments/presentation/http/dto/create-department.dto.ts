// class-validator
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body de criação de departamento (apresentação).
 *
 * `parkingSpace` (vagas) é **obrigatório** — a portaria só opera após o
 * cadastro das vagas (ADR 0006 §7); `0` é aceito (departamento sem vagas).
 */
export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsInt()
  @Min(0)
  parkingSpace!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
