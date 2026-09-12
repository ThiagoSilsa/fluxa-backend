// Constants
import type { EntryDenialReason } from '../../../blocks/domain/constants/block.constant';
import type { AccessRecordKind } from '../constants/access.constant';

/**
 * Registro do feed da portaria — entradas, saídas e impedimentos em uma linha
 * do tempo única (ADR 0015).
 *
 * É um **modelo de leitura** achatado: os dois ledgers (`vehicle_movement` e
 * `entry_denial`) continuam sendo a fonte, e os nomes (veículo, departamento,
 * portaria, porteiro) são resolvidos na consulta para o porteiro não precisar
 * de outra chamada.
 */
export interface AccessRecordEntity {
  /** Id do registro no ledger de origem. */
  id: string;
  /** `ENTRY` / `EXIT` / `DENIAL`. */
  kind: AccessRecordKind;
  /** Placa lida no momento (snapshot). */
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
  /** Momento real do evento. */
  occurredAt: Date;
  /** Acesso (`vehicle_access`) vinculado, quando houver. */
  accessId: string | null;
}
