// Types
import type { VehicleBlockEntity } from '../../domain/entities/vehicle-block.entity';
import type { BlockActorSummary, BlockResponse } from '../dto/block-response';

/**
 * Mapeia a entidade de domínio para a resposta de bloqueio (nunca expõe a
 * entidade crua — AGENTS.md §3).
 *
 * @param block Bloqueio de domínio.
 * @param blockedBy Resumo de quem bloqueou (resolvido) ou `null`.
 * @param revokedBy Resumo de quem revogou (resolvido) ou `null`.
 * @returns Bloqueio no formato de resposta.
 */
export function toBlockResponse(
  block: VehicleBlockEntity,
  blockedBy: BlockActorSummary | null,
  revokedBy: BlockActorSummary | null,
): BlockResponse {
  return {
    id: block.id,
    plate: block.plate,
    vehicleId: block.vehicleId,
    blockType: block.blockType,
    reason: block.reason,
    status: block.status,
    blockedBy,
    blockedAt: block.blockedAt.toISOString(),
    revokedBy,
    revokedAt: block.revokedAt ? block.revokedAt.toISOString() : null,
    revokedReason: block.revokedReason,
    createdAt: block.createdAt.toISOString(),
  };
}
