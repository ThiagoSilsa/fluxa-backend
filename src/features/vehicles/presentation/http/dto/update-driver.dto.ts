// class-validator
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Body de atualização do vínculo motorista ↔ veículo (PATCH — apresentação):
 * parcial — só os campos enviados mudam.
 */
export class UpdateDriverDto {
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  canDrive?: boolean;
}
