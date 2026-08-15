// class-transformer
import { Transform } from 'class-transformer';

// class-validator
import { IsEmail } from 'class-validator';

// Shared
import { normalizeEmail } from '../../../../../shared/utils/email.util';

/**
 * Query de consulta de existência de e-mail (apresentação).
 */
export class EmailStatusQueryDto {
  // Normaliza (trim + lowercase) antes de validar — Fase 0.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  email!: string;
}
