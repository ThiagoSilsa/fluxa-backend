// Types
import type { MovementSource } from '../../domain/constants/access.constant';

/**
 * Entrada do use case de registro de saída (já validada pelo controller).
 */
export class RegisterExitInputDto {
  constructor(
    /** Placa (normalizada na validação). */
    readonly plate: string,
    /** Passageiro identificado (NO_EXIT — regra 11). */
    readonly driverUserId?: string,
    /** Passageiro não cadastrado (NO_EXIT). */
    readonly temporaryDriverName?: string,
    /** Idempotência (opcional — servidor gera se ausente). */
    readonly idempotencyKey?: string,
    /** Origem (QRCODE/APP/MANUAL; default PLATE — M4). */
    readonly source?: MovementSource,
    /** Portaria do device (M4 — validada ativa na empresa). */
    readonly entranceId?: string,
  ) {}
}
