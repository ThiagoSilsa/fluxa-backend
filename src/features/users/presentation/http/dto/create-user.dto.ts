// class-transformer
import { Transform } from 'class-transformer';

// class-validator
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Shared
import { normalizeEmail } from '../../../../../shared/utils/email.util';
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

// Constants
import { UserType } from '../../../../auth/domain/constants/user-type.constant';

/**
 * Body de criação de usuário (apresentação).
 *
 * `name`/`password` são opcionais aqui porque o use case decide: pessoa nova
 * exige ambos; pessoa já existente **proíbe** ambos (e também
 * `phone`/`document`/`observation`) — ADR 0005 §2.
 */
export class CreateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  // Normaliza (trim + lowercase) antes de validar — o UNIQUE de `user.email`
  // é case-sensitive (Fase 0).
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password?: string;

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

  @IsEnum(UserType)
  type!: UserType;

  /** Cargo a vincular já na criação (1 cargo por empresa — ADR 0005 §5). */
  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  roleId?: string;
}
