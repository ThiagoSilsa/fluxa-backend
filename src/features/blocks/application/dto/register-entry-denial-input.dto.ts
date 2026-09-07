// Constants
import type { EntryDenialReason } from '../../domain/constants/block.constant';

/**
 * Entrada do use case de registro de impedimento (ledger).
 *
 * No access core (M3) este use case é chamado automaticamente pelo endpoint
 * de entrada ao negar (ADR 0010 §3); aqui também exposto como endpoint manual
 * (`REGISTER_DENIAL`).
 */
export class RegisterEntryDenialInputDto {
  constructor(
    /** Placa (normalizada na validação). */
    readonly plate: string,
    /** Motivo do impedimento. */
    readonly reason: EntryDenialReason,
    /** Observação livre do porteiro. */
    readonly observation?: string,
    /** Bloqueio que motivou (se houver). */
    readonly blockId?: string,
    /** Veículo envolvido (resolvido da placa quando cadastrado). */
    readonly vehicleId?: string,
  ) {}
}
