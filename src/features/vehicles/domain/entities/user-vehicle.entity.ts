/**
 * Vínculo motorista ↔ veículo (por empresa) — entidade de domínio.
 *
 * Espelha a tabela `user_vehicle` (migration `0002`). O unique
 * `(company_id, user_id, vehicle_id)` evita vínculo duplicado; **apenas 1
 * proprietário primário** por veículo (unique parcial `is_primary = true`).
 * `canDrive` controla a autorização na portaria (semana 3+). A tabela **não
 * tem** `is_active` — a remoção é física (ADR 0006 §2).
 */
export interface UserVehicleEntity {
  /** Id do vínculo. */
  id: string;
  /** Empresa dona do vínculo. */
  companyId: string;
  /** Motorista (pessoa — identidade global, ADR 0002). */
  userId: string;
  /** Veículo vinculado. */
  vehicleId: string;
  /** Proprietário principal do veículo (1 por veículo). */
  isPrimary: boolean;
  /** Autorizado a dirigir (porteiro verifica na portaria). */
  canDrive: boolean;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}

/**
 * Vínculo motorista ↔ veículo com o nome do motorista agregado — usado nas
 * respostas.
 */
export interface UserVehicleWithUserEntity extends UserVehicleEntity {
  /** Motorista (id + nome). */
  user: {
    /** Id do motorista. */
    id: string;
    /** Nome do motorista. */
    name: string;
  };
}
