// Types
import type { DepartmentEntity } from '../../../departments/domain/entities/department.entity';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
import type { VehicleAccessRepository } from '../../domain/repositories/vehicle-access.repository';

/**
 * Fontes de dados da ocupação (injetadas — mantém o util puro/testável).
 */
export interface CapacitySources {
  /** Contadores de `vehicle_access` INSIDE. */
  vehicleAccessRepository: Pick<
    VehicleAccessRepository,
    'countInsideByDepartmentIdAndCompanyId' | 'countInsideByCompanyId'
  >;
  /** Departamentos ativos (soma das vagas livres — regra 24). */
  departmentRepository: Pick<DepartmentRepository, 'list'>;
}

/**
 * Ocupação/capacidade vigentes (regras 21/24): por departamento ou vagas
 * livres (soma do `parkingSpace` dos departamentos ativos).
 *
 * Extraído do `RegisterEntryUseCase` para ser a **mesma** regra usada pelo
 * contexto/veredito da portaria (ADR 0014 §2) — sem duplicação.
 *
 * @param companyId Empresa da sessão.
 * @param department Departamento considerado (ou `null` = vagas livres).
 * @param sources Repositórios de contagem/departamentos.
 * @returns Ocupação e capacidade atuais.
 */
export async function resolveCapacity(
  companyId: string,
  department: DepartmentEntity | null,
  sources: CapacitySources,
): Promise<{ occupied: number; capacity: number }> {
  if (department) {
    const occupied =
      await sources.vehicleAccessRepository.countInsideByDepartmentIdAndCompanyId(
        department.id,
        companyId,
      );
    return { occupied, capacity: department.parkingSpace };
  }

  const occupied =
    await sources.vehicleAccessRepository.countInsideByCompanyId(companyId);
  const { data: departments } = await sources.departmentRepository.list(
    companyId,
    { isActive: true, limit: 100, offset: 0 },
  );
  const capacity = departments.reduce((sum, d) => sum + d.parkingSpace, 0);
  return { occupied, capacity };
}

/**
 * Há vaga livre? Capacidade não configurada (`0`) não restringe a entrada
 * (mesma condição do `POST /access/entry`).
 *
 * @param capacity Capacidade do setor.
 * @param occupied Veículos dentro.
 * @returns `true` quando pode entrar sem `overCapacity`.
 */
export function hasFreeSlot(capacity: number, occupied: number): boolean {
  return capacity <= 0 || occupied < capacity;
}
