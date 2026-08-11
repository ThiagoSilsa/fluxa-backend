import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * DTO de apresentação do login — valida a entrada HTTP (`POST /auth/login`).
 *
 * `companyId` é opcional e vem na MESMA requisição da credencial (evita
 * autenticação por parâmetro — ADR 0002). Decorators apenas `class-validator`
 * (Swagger fica no arquivo `api-<feature>.decorator.ts`).
 */
export class LoginDto {
  /** E-mail da pessoa (identidade global). */
  @IsEmail()
  email!: string;

  /** Senha em texto puro. */
  @IsString()
  @MinLength(1)
  password!: string;

  /** Empresa escolhida (opcional — multi-empresa). */
  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  companyId?: string;
}
