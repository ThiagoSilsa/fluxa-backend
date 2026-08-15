/**
 * Vínculo departamento padrão do veículo no formato de resposta (nunca a
 * entidade crua do banco — AGENTS.md §3).
 */
export interface VehicleDepartmentResponse {
  /** Id do vínculo. */
  id: string;
  /** Id do veículo. */
  vehicleId: string;
  /** Id do departamento padrão. */
  departmentId: string;
  /** Departamento padrão (id + nome) ou `null` se não resolvido. */
  department: { id: string; name: string } | null;
  /** Se o vínculo está ativo. */
  isActive: boolean;
}
