// Types
import type { AccessRecordEntity } from '../../domain/entities/access-record.entity';
import type { AccessRecordResponse } from '../dto/access-record-response';

/**
 * Mapeia o registro do feed (modelo de leitura) para a resposta — nunca expõe
 * a entidade crua (AGENTS.md §3).
 *
 * @param record Registro do feed.
 * @returns Registro no formato de resposta.
 */
export function toAccessRecordResponse(
  record: AccessRecordEntity,
): AccessRecordResponse {
  return {
    id: record.id,
    kind: record.kind,
    plate: record.plate,
    driverName: record.driverName,
    vehicleModel: record.vehicleModel,
    departmentName: record.departmentName,
    entranceName: record.entranceName,
    doormanName: record.doormanName,
    reason: record.reason,
    observation: record.observation,
    occurredAt: record.occurredAt.toISOString(),
    accessId: record.accessId,
  };
}
