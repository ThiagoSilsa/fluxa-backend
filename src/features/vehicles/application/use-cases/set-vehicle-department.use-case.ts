// NestJS
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

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
import type { SetVehicleDepartmentInputDto } from '../dto/set-vehicle-department-input.dto';
import type { VehicleDepartmentResponse } from '../dto/vehicle-department-response';

/**
 * Define (ou substitui) o departamento padrão do veículo — `PUT` com upsert
 * na linha única `(company_id, vehicle_id)` (ADR 0006 §8).
 *
 * O departamento deve existir na empresa (404) e estar **ativo** (400).
 */
@Injectable()
export class SetVehicleDepartmentUseCase {
  private readonly logger = new Logger(SetVehicleDepartmentUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_DEPARTMENT_REPOSITORY)
    private readonly vehicleDepartmentRepository: VehicleDepartmentRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  /**
   * Define o departamento padrão do veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Ids do veículo e do departamento.
   * @returns Vínculo ativo com o departamento resolvido.
   * @throws {NotFoundException} Veículo ou departamento não existe na empresa.
   * @throws {BadRequestException} Departamento inativo.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: SetVehicleDepartmentInputDto,
  ): Promise<VehicleDepartmentResponse> {
    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      input.vehicleId,
      actor.companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    const department = await this.departmentRepository.findByIdAndCompanyId(
      input.departmentId,
      actor.companyId,
    );
    if (!department) {
      throw new NotFoundException('Departamento não encontrado.');
    }
    if (!department.isActive) {
      throw new BadRequestException(
        'Departamento inativo não pode ser definido como padrão.',
      );
    }

    const link =
      await this.vehicleDepartmentRepository.upsertByVehicleIdAndCompanyId(
        input.vehicleId,
        actor.companyId,
        input.departmentId,
      );

    return toVehicleDepartmentResponse(link, {
      id: department.id,
      name: department.name,
    });
  }
}
