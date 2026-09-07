// Types
import type { AccessRequestEntity } from '../../domain/entities/access-request.entity';
import type {
  AccessRequestActorSummary,
  AccessRequestResponse,
} from '../dto/access-request-response';

/**
 * Mapeia a entidade de domínio para a resposta de solicitação de acesso
 * (nunca expõe a entidade crua — AGENTS.md §3).
 *
 * @param request Solicitação de domínio.
 * @param requestedBy Resumo de quem solicitou.
 * @param handledBy Resumo de quem atendeu ou `null`.
 * @param authorizedBy Resumo de quem autorizou a entrada ou `null`.
 * @returns Solicitação no formato de resposta.
 */
export function toAccessRequestResponse(
  request: AccessRequestEntity,
  requestedBy: AccessRequestActorSummary,
  handledBy: AccessRequestActorSummary | null,
  authorizedBy: AccessRequestActorSummary | null,
): AccessRequestResponse {
  return {
    id: request.id,
    type: request.type,
    plate: request.plate,
    vehicleId: request.vehicleId,
    userId: request.userId,
    status: request.status,
    entryAuthorized: request.entryAuthorized,
    requestedBy,
    requestedAt: request.requestedAt.toISOString(),
    handledBy,
    handledAt: request.handledAt ? request.handledAt.toISOString() : null,
    authorizedBy,
    authorizedAt: request.authorizedAt
      ? request.authorizedAt.toISOString()
      : null,
    contactChannel: request.contactChannel,
    contactPhone: request.contactPhone,
    departmentId: request.departmentId,
    payload: request.payload,
    statusHistory: request.statusHistory,
    resolvedUserId: request.resolvedUserId,
    resolvedVehicleId: request.resolvedVehicleId,
    observation: request.observation,
    createdAt: request.createdAt.toISOString(),
  };
}
