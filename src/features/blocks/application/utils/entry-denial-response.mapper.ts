// Types
import type { EntryDenialEntity } from '../../domain/entities/entry-denial.entity';
import type { EntryDenialResponse } from '../dto/entry-denial-response';

/**
 * Mapeia a entidade de domínio para a resposta de impedimento (nunca expõe a
 * entidade crua — AGENTS.md §3).
 *
 * @param denial Impedimento de domínio.
 * @returns Impedimento no formato de resposta.
 */
export function toEntryDenialResponse(
  denial: EntryDenialEntity,
): EntryDenialResponse {
  return {
    id: denial.id,
    plateSnapshot: denial.plateSnapshot,
    vehicleId: denial.vehicleId,
    blockId: denial.blockId,
    reason: denial.reason,
    observation: denial.observation,
    doormanId: denial.doormanId,
    occurredAt: denial.occurredAt.toISOString(),
  };
}
