// class-validator
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Shared
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * Query do contexto + veredito da entrada (ficha da portaria — ADR 0014 §2).
 */
export class GetAccessContextQueryDto {
  /** Placa lida/digitada na portaria. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  plate!: string;

  /** Busca de motorista (nome/telefone/documento) — habilita as sugestões. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /** Setor para o qual a ocupação é avaliada (default: padrão do veículo). */
  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  departmentId?: string;

  /** Motorista escolhido na ficha (o veredito passa a refletir esse motorista). */
  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  driverUserId?: string;
}
