// Types
import type { EntranceEntity } from '../../domain/entities/entrance.entity';
import type { EntranceResponse } from '../dto/entrance-response';

/**
 * Mapeia a entidade de domínio para a resposta de portaria (nunca expõe a
 * entidade crua — AGENTS.md §3).
 *
 * @param entrance Portaria de domínio.
 * @returns Portaria no formato de resposta.
 */
export function toEntranceResponse(entrance: EntranceEntity): EntranceResponse {
  return {
    id: entrance.id,
    name: entrance.name,
    isActive: entrance.isActive,
  };
}
