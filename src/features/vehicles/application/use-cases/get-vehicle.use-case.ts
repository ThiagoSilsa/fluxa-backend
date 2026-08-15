// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repositories
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import { USER_VEHICLE_REPOSITORY } from '../../domain/repositories/user-vehicle.repository';
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../domain/repositories/vehicle-department.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Mapper
import { toVehicleResponse } from '../utils/vehicle-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
import type { UserVehicleRepository } from '../../domain/repositories/user-vehicle.repository';
import type { VehicleDepartmentRepository } from '../../domain/repositories/vehicle-department.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { GetVehicleInputDto } from '../dto/get-vehicle-input.dto';
import type {
  VehicleDriverResponse,
  VehicleResponse,
} from '../dto/vehicle-response';

/**
 * Busca um veículo por id na empresa da sessão — **detalhe agregado** (ADR
 * 0006 §11): veículo + tipo + departamento padrão ativo + motoristas +
 * `is_blocked` (derivado).
 */
@Injectable()
export class GetVehicleUseCase {
  private readonly logger = new Logger(GetVehicleUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_DEPARTMENT_REPOSITORY)
    private readonly vehicleDepartmentRepository: VehicleDepartmentRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
    @Inject(USER_VEHICLE_REPOSITORY)
    private readonly userVehicleRepository: UserVehicleRepository,
  ) {}

  /**
   * Detalha um veículo da empresa do ator com o agregado completo.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do veículo.
   * @returns Veículo da empresa com tipo, departamento padrão e motoristas.
   * @throws {NotFoundException} Quando o veículo não existe na empresa
   * (cross-tenant não é revelado — mesma resposta, ADR 0006 §1).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetVehicleInputDto,
  ): Promise<VehicleResponse> {
    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    const [department, drivers] = await Promise.all([
      this.resolveDepartment(input.id, actor.companyId),
      this.resolveDrivers(input.id, actor.companyId),
    ]);

    return { ...toVehicleResponse(vehicle), department, drivers };
  }

  /**
   * Resolve o departamento padrão **ativo** do veículo (id + nome), ou `null`
   * se não houver vínculo ativo.
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Departamento padrão ou `null`.
   */
  private async resolveDepartment(
    vehicleId: string,
    companyId: string,
  ): Promise<{ id: string; name: string } | null> {
    const link =
      await this.vehicleDepartmentRepository.findActiveByVehicleIdAndCompanyId(
        vehicleId,
        companyId,
      );
    if (!link) {
      return null;
    }
    const department = await this.departmentRepository.findByIdAndCompanyId(
      link.departmentId,
      companyId,
    );
    return department ? { id: department.id, name: department.name } : null;
  }

  /**
   * Resolve os motoristas vinculados ao veículo.
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Motoristas (id + nome, `isPrimary`, `canDrive`).
   */
  private async resolveDrivers(
    vehicleId: string,
    companyId: string,
  ): Promise<VehicleDriverResponse[]> {
    const links = await this.userVehicleRepository.findByVehicleIdAndCompanyId(
      vehicleId,
      companyId,
    );
    return links.map((link) => ({
      id: link.id,
      user: { id: link.user.id, name: link.user.name },
      isPrimary: link.isPrimary,
      canDrive: link.canDrive,
    }));
  }
}
