// Constants
import { AccessRequestStatus } from '../../domain/constants/access-request.constant';

/**
 * Prazo de uma solicitação em `PENDING` (dias corridos — regra 38).
 */
export const ACCESS_REQUEST_PENDING_DEADLINE_DAYS = 3;

/**
 * Teto do prazo quando a administração já está em contato (`IN_CONTACT` —
 * regra 39).
 */
export const ACCESS_REQUEST_IN_CONTACT_DEADLINE_DAYS = 7;

/** Milissegundos de um dia (cálculo em dias corridos). */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Prazo calculado de uma solicitação de acesso.
 */
export interface AccessRequestDeadline {
  /** Limite vigente (ISO no formato `Date`) — `null` para status sem prazo. */
  deadline: Date | null;
  /** O prazo vigente já passou? */
  isOverdue: boolean;
  /** Dias corridos desde a solicitação (para a ficha dizer "há N dias"). */
  daysSinceRequest: number;
}

/**
 * Calcula o prazo de uma solicitação (regras 38/39) **sem alterar estado** —
 * o bloqueio automático por prazo (`vehicle_block` AUTOMATIC) é tarefa futura
 * (ADR 0014 §4); a portaria apenas exibe o veredito.
 *
 * - `PENDING` → 3 dias corridos de `requested_at`;
 * - `IN_CONTACT` → 7 dias corridos (a administração já está em contato);
 * - demais status → sem prazo (não vence).
 *
 * @param requestedAt Quando a solicitação foi criada.
 * @param status Status atual da solicitação.
 * @param now Referência de tempo (default: agora) — injetável nos testes.
 * @returns Prazo-limite, se venceu e dias corridos desde a solicitação.
 */
export function resolveAccessRequestDeadline(
  requestedAt: Date,
  status: AccessRequestStatus,
  now: Date = new Date(),
): AccessRequestDeadline {
  const daysSinceRequest = Math.max(
    0,
    Math.floor((now.getTime() - requestedAt.getTime()) / MS_PER_DAY),
  );

  const deadlineDays = AccessRequestDeadlineDays[status];
  if (!deadlineDays) {
    return { deadline: null, isOverdue: false, daysSinceRequest };
  }

  const deadline = new Date(requestedAt.getTime() + deadlineDays * MS_PER_DAY);
  return {
    deadline,
    isOverdue: now.getTime() > deadline.getTime(),
    daysSinceRequest,
  };
}

/**
 * Prazo (em dias) por status da solicitação — `undefined` = sem prazo.
 */
const AccessRequestDeadlineDays: Record<
  AccessRequestStatus,
  number | undefined
> = {
  [AccessRequestStatus.PENDING]: ACCESS_REQUEST_PENDING_DEADLINE_DAYS,
  [AccessRequestStatus.IN_CONTACT]: ACCESS_REQUEST_IN_CONTACT_DEADLINE_DAYS,
  [AccessRequestStatus.REGISTERED]: undefined,
  [AccessRequestStatus.REJECTED]: undefined,
  [AccessRequestStatus.CANCELLED]: undefined,
};
