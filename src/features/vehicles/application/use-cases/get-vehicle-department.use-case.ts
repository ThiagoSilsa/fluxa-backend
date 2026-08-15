// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repositories
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../domain/repositories/vehicle-department.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Mapper
import { toVehicleDepartmentResponse } from '../utils/vehicle-department-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
import type { VehicleDepartmentRepository } from '../../domain/repositories/vehicle-department.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { GetVehicleDepartmentInputDto } from '../dto/get-vehicle-department-input.dto';
import type { VehicleDepartmentResponse } from '../dto/vehicle-department-response';

/**
 * Busca o departamento padrão ativo de um veículo na empresa da sessão.
 */
@Injectable()
export class GetVehicleDepartmentUseCase {
  private readonly logger = new Logger(GetVehicleDepartmentUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_DEPARTMENT_REPOSITORY)
    private readonly vehicleDepartmentRepository: VehicleDepartmentRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  /**
   * Detalha o vínculo ativo do veículo (com o departamento resolvido).
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do veículo.
   * @returns Vínculo ativo com o departamento.
   * @throws {NotFoundException} Veículo não existe na empresa ou não tem
   * vínculo ativo.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetVehicleDepartmentInputDto,
  ): Promise<VehicleDepartmentResponse> {
    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      input.vehicleId,
      actor.companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    const link =
      await this.vehicleDepartmentRepository.findActiveByVehicleIdAndCompanyId(
        input.vehicleId,
        actor.companyId,
      );
    if (!link) {
      throw new NotFoundException(
        'Departamento padrão não definido para o veículo.',
      );
    }

    const department = await this.departmentRepository.findByIdAndCompanyId(
      link.departmentId,
      actor.companyId,
    );

    return toVehicleDepartmentResponse(
      link,
      department ? { id: department.id, name: department.name } : null,
    );
  }
}
