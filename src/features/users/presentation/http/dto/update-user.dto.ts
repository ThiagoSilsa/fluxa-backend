// class-transformer
import { Transform } from 'class-transformer';

// class-validator
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Shared
import { normalizeEmail } from '../../../../../shared/utils/email.util';

// Constants
import { UserType } from '../../../../auth/domain/constants/user-type.constant';

/**
 * Body de edição de usuário (apresentação) — edição **parcial** (ADR 0005
 * §3): só os campos enviados mudam. Senha nunca é editada por PATCH.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  // Normaliza (trim + lowercase) antes de validar — Fase 0.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  document?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string;

  @IsOptional()
  @IsEnum(UserType)
  type?: UserType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
