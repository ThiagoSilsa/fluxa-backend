// class-validator
import { IsOptional, IsString } from 'class-validator';

/**
 * Body de transições de solicitação (rejeitar, cancelar, marcar em contato) —
 * observação opcional.
 */
export class HandleAccessRequestDto {
  @IsOptional()
  @IsString()
  observation?: string;
}
