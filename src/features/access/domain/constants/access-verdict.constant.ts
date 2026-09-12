/**
 * Veredito de entrada (ADR 0014 §3) — a **decisão única** que a portaria
 * apresenta ao porteiro para uma placa.
 *
 * Substitui a árvore de perguntas do balcão: o servidor decide (bloqueio,
 * passe livre, motorista, solicitação, prazo, capacidade) e o cliente apenas
 * exibe o veredito e coleta o que falta. Só `ALLOW_OVER_CAPACITY` e
 * `ALLOW_FORCED_REENTRY` pedem confirmação extra; os demais têm ação única.
 */
export enum AccessVerdict {
  /** Pode liberar (passe livre ou motorista vinculado com `can_drive`). */
  ALLOW = 'ALLOW',
  /** Libera criando/reaproveitando a solicitação (exceção de cadastro/vínculo). */
  ALLOW_WITH_REQUEST = 'ALLOW_WITH_REQUEST',
  /** Vaga cheia no departamento escolhido — exige `overCapacity = true`. */
  ALLOW_OVER_CAPACITY = 'ALLOW_OVER_CAPACITY',
  /** Já existe acesso aberto — a saída anterior será encerrada (regra 9). */
  ALLOW_FORCED_REENTRY = 'ALLOW_FORCED_REENTRY',
  /** Bloqueio ativo prevalece sobre tudo (regra 20). */
  DENY_BLOCKED = 'DENY_BLOCKED',
  /** Solicitação da placa vencida (regras 38/39) e sem pré-autorização. */
  DENY_OVERDUE = 'DENY_OVERDUE',
  /** Veículo cadastrado e inativo. */
  DENY_INACTIVE = 'DENY_INACTIVE',
}

/**
 * Motivos que compõem o veredito — o cliente usa para explicar a decisão no
 * lugar de recalcular regra de negócio (ADR 0014 §2).
 */
export enum AccessVerdictReason {
  /** Bloqueio ativo (por veículo ou por placa). */
  BLOCKED = 'BLOCKED',
  /** Veículo cadastrado e inativo. */
  INACTIVE = 'INACTIVE',
  /** Passe livre libera sem condutor (regra 3). */
  FREE_PASS = 'FREE_PASS',
  /** Motorista vinculado com `can_drive`. */
  DRIVER_ALLOWED = 'DRIVER_ALLOWED',
  /** Já existe acesso aberto (reentrada — regra 9). */
  REENTRY = 'REENTRY',
  /** Solicitação da placa em análise (`PENDING`/`IN_CONTACT`) — informativo. */
  REQUEST_OPEN = 'REQUEST_OPEN',
  /** Solicitação da placa vencida (regras 38/39). */
  REQUEST_OVERDUE = 'REQUEST_OVERDUE',
  /** Solicitação pré-autorizada pela administração. */
  REQUEST_PRE_AUTHORIZED = 'REQUEST_PRE_AUTHORIZED',
  /** Veículo não cadastrado (regra 5 — libera com solicitação). */
  UNREGISTERED_VEHICLE = 'UNREGISTERED_VEHICLE',
  /** Motorista sem vínculo com o veículo (ou sem permissão de dirigir). */
  UNREGISTERED_DRIVER = 'UNREGISTERED_DRIVER',
  /** Motorista vinculado, mas sem `can_drive`. */
  DRIVER_NOT_ALLOWED = 'DRIVER_NOT_ALLOWED',
  /** Vaga cheia no departamento (regras 6/25). */
  CAPACITY_FULL = 'CAPACITY_FULL',
}

/**
 * Códigos de permissão de bloqueio — reexportado para o cliente não depender
 * do enum de `blocks` (evita acoplamento entre features no contrato HTTP).
 */
export type { VehicleBlockType } from '../../../blocks/domain/constants/block.constant';
