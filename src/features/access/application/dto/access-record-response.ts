// Shared
import type { ParameterDto } from '../../../../shared/dto/parameter.dto';

// Constants
import type { EntryDenialReason } from '../../../blocks/domain/constants/block.constant';
import type { AccessRecordKind } from '../../domain/constants/access.constant';

/**
 * Registro do feed da portaria no formato de resposta (ADR 0015).
 */
export interface AccessRecordResponse {
  /** Id do registro no ledger de origem. */
  id: string;
  /** `ENTRY` / `EXIT` / `DENIAL`. */
  kind: AccessRecordKind;
  /** Placa lida no momento. */
  plate: string;
  /** Condutor identificado ou nome temporário. */
  driverName: string | null;
  /** Modelo do veículo (quando cadastrado). */
  vehicleModel: string | null;
  /** Departamento confirmado no momento. */
  departmentName: string | null;
  /** Portaria do device que registrou. */
  entranceName: string | null;
  /** Porteiro que registrou. */
  doormanName: string | null;
  /** Motivo do impedimento (apenas em `DENIAL`). */
  reason: EntryDenialReason | null;
  /** Observação do impedimento (apenas em `DENIAL`). */
  observation: string | null;
  /** Momento real do evento (ISO). */
  occurredAt: string;
  /** Acesso (`vehicle_access`) vinculado, quando houver. */
  accessId: string | null;
}

/**
 * Resposta paginada do feed — formato padrão do AGENTS.md §3 (`limit`,
 * `offset`, `data`, `count`, `parameters?`).
 */
export interface ListAccessRecordsResponse {
  /** Quantidade de registros retornados. */
  limit: number;
  /** Offset da página. */
  offset: number;
  /** Registros da página (mais recente primeiro). */
  data: AccessRecordResponse[];
  /** Total de registros (sem paginação). */
  count: number;
  /** Metadados dos filtros (portarias ativas para o filtro de portaria). */
  parameters?: ParameterDto[];
}
