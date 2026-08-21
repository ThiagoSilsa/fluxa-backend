/**
 * Vínculo permanente: departamento padrão do veículo (por empresa) — entidade
 * de domínio.
 *
 * Espelha a tabela `vehicle_department` (migration `0002`). O unique
 * `(company_id, vehicle_id)` permite **um** departamento padrão por veículo;
 * o contrato é de *upsert* na linha única (ADR 0006 §8).
 */
export interface VehicleDepartmentEntity {
  /** Id do vínculo. */
  id: string;
  /** Empresa dona do vínculo. */
  companyId: string;
  /** Veículo vinculado. */
  vehicleId: string;
  /** Departamento padrão do veículo. */
  departmentId: string;
  /** Se o vínculo está ativo (desativar remove o departamento padrão). */
  isActive: boolean;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}
