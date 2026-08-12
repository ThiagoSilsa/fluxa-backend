import { Matches } from 'class-validator';
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * DTO de apresentação da troca de empresa — `POST /auth/switch-company`.
 *
 * Valida apenas o formato do `companyId`; a autorização (vínculo ativo) é
 * conferida pelo servidor na emissão do token (ADR 0002).
 */
export class SwitchCompanyDto {
  /** Id da empresa de destino da sessão. */
  @Matches(UUID_ANY_VERSION_PATTERN)
  companyId!: string;
}
