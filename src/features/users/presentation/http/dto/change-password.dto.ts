// class-validator
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body de troca de senha (apresentação) — mínimo 6 caracteres (regra §1.4).
 */
export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  newPassword!: string;
}
