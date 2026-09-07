// NestJS
import { Inject, Injectable, Logger } from '@nestjs/common';

// Repositories
import { VEHICLE_ACCESS_REPOSITORY } from '../../domain/repositories/vehicle-access.repository';
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleAccessRepository } from '../../domain/repositories/vehicle-access.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
import type { OccupancyResponse } from '../dto/access-response';

/**
 * Consulta a ocupação em tempo real (VIEW_DASHBOARDS) — regras 21–24.
 *
 * Todos os veículos `INSIDE` ocupam espaço (sem exceção). Capacidade das
 * vagas livres = soma do `parkingSpace` dos departamentos **ativos**;
 * veículo sem departamento conta nas vagas livres (fallback do total).
 */
@Injectable()
export class GetOccupancyUseCase {
  private readonly logger = new Logger(GetOccupancyUseCase.name);

  constructor(
    @Inject(VEHICLE_ACCESS_REPOSITORY)
    private readonly vehicleAccessRepository: VehicleAccessRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  /**
   * Calcula a ocupação da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @returns Ocupação total + por departamento ativo.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
  ): Promise<OccupancyResponse> {
    const companyId = actor.companyId;

    const { data: departments } = await this.departmentRepository.list(
      companyId,
      { isActive: true, limit: 100, offset: 0 },
    );

    const [totalOccupied, byDepartment] = await Promise.all([
      this.vehicleAccessRepository.countInsideByCompanyId(companyId),
      Promise.all(
        departments.map(async (department) => ({
          departmentId: department.id,
          name: department.name,
          occupied:
            await this.vehicleAccessRepository.countInsideByDepartmentIdAndCompanyId(
              department.id,
              companyId,
            ),
          capacity: department.parkingSpace,
        })),
      ),
    ]);

    const totalCapacity = departments.reduce(
      (sum, department) => sum + department.parkingSpace,
      0,
    );

    return {
      totalOccupied,
      totalCapacity,
      freeSlots: Math.max(0, totalCapacity - totalOccupied),
      byDepartment,
    };
  }
}
