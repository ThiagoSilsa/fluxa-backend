// Types
import type { MovementSource } from '../../domain/constants/access.constant';

/**
 * Entrada do use case de registro de entrada (já validada pelo controller).
 */
export class RegisterEntryInputDto {
  constructor(
    /** Placa (normalizada na validação). */
    readonly plate: string,
    /** Condutor identificado (veículo cadastrado sem free_pass). */
    readonly driverUserId?: string,
    /** Condutor temporário (solicitação autorizada — ADR 0010 §4). */
    readonly temporaryDriverName?: string,
    /** Setor confirmado na entrada (opcional — usa o padrão do veículo). */
    readonly departmentId?: string,
    /** Solicitação de acesso autorizada. */
    readonly accessRequestId?: string,
    /** Liberar mesmo com vaga cheia (409 pede confirmação). */
    readonly overCapacity: boolean = false,
    /** Idempotência (opcional — servidor gera se ausente). */
    readonly idempotencyKey?: string,
    /** Origem (QRCODE/APP/MANUAL; default PLATE — M4). */
    readonly source?: MovementSource,
    /** Portaria do device (M4 — validada ativa na empresa). */
    readonly entranceId?: string,
  ) {}
}
