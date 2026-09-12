// class-validator
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Constants
import { EntryDenialReason } from '../../../domain/constants/block.constant';

// Shared
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * Body de registro de impedimento (apresentação).
 */
export class RegisterEntryDenialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  plate!: string;

  /**
   * Motivo do impedimento. `OVERDUE` cobre a solicitação vencida (regras
   * 38/39); `OTHER` exige observação (a administração precisa saber o porquê).
   */
  @IsEnum(EntryDenialReason)
  reason!: EntryDenialReason;

  @IsOptional()
  @IsString()
  observation?: string;

  /** Veículo informado pelo cliente (o servidor resolve pela placa também). */
  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  vehicleId?: string;

  /** Portaria do device que impediu (validada ativa na empresa). */
  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  entranceId?: string;

  /** Bloqueio que motivou o impedimento (opcional). */
  @IsOptional()
  @Matches(UUID_ANY_VERSION_PATTERN)
  blockId?: string;

  /**
   * Pede o bloqueio do veículo no mesmo fluxo (desmarcado por padrão). O
   * porteiro **solicita** (`block_request`) — nunca cria o bloqueio direto.
   */
  @IsOptional()
  @IsBoolean()
  requestBlock?: boolean;

  /** Motivo da solicitação de bloqueio (default: a observação do impedimento). */
  @IsOptional()
  @IsString()
  blockReason?: string;
}
