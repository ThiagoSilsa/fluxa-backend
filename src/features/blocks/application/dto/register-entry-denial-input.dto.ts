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
    /** Observação livre do porteiro (obrigatória em `OTHER`). */
    readonly observation?: string,
    /** Bloqueio que motivou (se houver). */
    readonly blockId?: string,
    /** Veículo envolvido (resolvido da placa quando cadastrado). */
    readonly vehicleId?: string,
    /** Portaria do device que impediu (M4 — validada ativa na empresa). */
    readonly entranceId?: string,
    /** Pede o bloqueio do veículo no mesmo fluxo (desmarcado por padrão). */
    readonly requestBlock: boolean = false,
    /** Motivo da solicitação de bloqueio (default: a observação). */
    readonly blockReason?: string,
  ) {}
}
