/**
 * Vínculo motorista ↔ veículo no formato de resposta (nunca a entidade crua
 * do banco — AGENTS.md §3).
 */
export interface UserVehicleDriverResponse {
  /** Id do vínculo. */
  id: string;
  /** Id do veículo. */
  vehicleId: string;
  /** Motorista (id + nome). */
  user: {
    /** Id do motorista. */
    id: string;
    /** Nome do motorista. */
    name: string;
  };
  /** Proprietário principal do veículo. */
  isPrimary: boolean;
  /** Autorizado a dirigir. */
  canDrive: boolean;
}

/**
 * Resposta da listagem de motoristas de um veículo (lista aninhada, sem
 * paginação — espelha o padrão de `role_permission`).
 */
export interface ListVehicleDriversResponse {
  /** Veículo consultado. */
  vehicleId: string;
  /** Motoristas vinculados. */
  drivers: UserVehicleDriverResponse[];
}
