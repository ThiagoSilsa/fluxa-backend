// Types
import type { BlockRequestEntity } from '../../domain/entities/block-request.entity';
import type {
  BlockRequestActorSummary,
  BlockRequestResponse,
} from '../dto/block-request-response';

/**
 * Mapeia a entidade de domínio para a resposta de solicitação de bloqueio
 * (nunca expõe a entidade crua — AGENTS.md §3).
 *
 * @param request Solicitação de domínio.
 * @param requestedBy Resumo de quem solicitou.
 * @param handledBy Resumo de quem avaliou ou `null`.
 * @returns Solicitação no formato de resposta.
 */
export function toBlockRequestResponse(
  request: BlockRequestEntity,
  requestedBy: BlockRequestActorSummary,
  handledBy: BlockRequestActorSummary | null,
): BlockRequestResponse {
  return {
    id: request.id,
    plate: request.plate,
    vehicleId: request.vehicleId,
    reason: request.reason,
    status: request.status,
    requestedBy,
    requestedAt: request.requestedAt.toISOString(),
    handledBy,
    handledAt: request.handledAt ? request.handledAt.toISOString() : null,
    observation: request.observation,
    statusHistory: request.statusHistory,
    resolvedBlockId: request.resolvedBlockId,
    createdAt: request.createdAt.toISOString(),
  };
}
