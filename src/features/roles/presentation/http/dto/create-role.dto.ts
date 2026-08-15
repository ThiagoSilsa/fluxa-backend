// class-validator
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Body de criação de cargo (apresentação).
 *
 * `isAdmin` é aceito para rejeitar explicitamente `true` no use case (ADR
 * 0004) — cargos de administração são do sistema.
 */
export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}
