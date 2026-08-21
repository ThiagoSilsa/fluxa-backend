// Types
import type { VehicleDepartmentEntity } from '../entities/vehicle-department.entity';

/**
 * Symbol token de injeção do `VehicleDepartmentRepository`.
 */
export const VEHICLE_DEPARTMENT_REPOSITORY = Symbol(
  'VEHICLE_DEPARTMENT_REPOSITORY',
);

/**
 * Contrato do repositório de departamento padrão do veículo.
 *
 * Escopado por `company_id`. O unique `(company_id, vehicle_id)` permite uma
 * única linha por veículo — o *upsert* reutiliza a linha (ativa ou inativa)
 * em vez de criar uma segunda (ADR 0006 §8).
 */
export interface VehicleDepartmentRepository {
  /**
   * Define (ou substitui) o departamento padrão do veículo — cria a linha
   * única se não existir, ou reativa/atualiza a linha existente.
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @param departmentId Departamento padrão.
   * @returns Vínculo ativo resultante.
   */
  upsertByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
    departmentId: string,
  ): Promise<VehicleDepartmentEntity>;

  /**
   * Busca o vínculo **ativo** do veículo na empresa.
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Vínculo ativo ou `null` se não existir/estiver inativo.
   */
  findActiveByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<VehicleDepartmentEntity | null>;

  /**
   * Desativa o vínculo ativo do veículo (`is_active = false`) — o veículo
   * fica sem departamento padrão (vagas livres na portaria).
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Vínculo desativado ou `null` se não havia vínculo ativo.
   */
  deactivateByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<VehicleDepartmentEntity | null>;
}
