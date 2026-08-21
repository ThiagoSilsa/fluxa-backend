// class-validator
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Body de revogação de bloqueio (apresentação) — motivo obrigatório.
 */
export class RevokeBlockDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
