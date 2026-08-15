// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repositories
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../domain/repositories/vehicle-department.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleDepartmentRepository } from '../../domain/repositories/vehicle-department.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { RemoveVehicleDepartmentInputDto } from '../dto/remove-vehicle-department-input.dto';

/**
 * Remove o departamento padrão de um veículo — `DELETE` desativa o vínculo
 * único (`is_active = false`), deixando o veículo sem departamento padrão
 * (vagas livres na portaria). Idempotente: sem vínculo ativo, não faz nada
 * (ADR 0006 §8).
 */
@Injectable()
export class RemoveVehicleDepartmentUseCase {
  private readonly logger = new Logger(RemoveVehicleDepartmentUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_DEPARTMENT_REPOSITORY)
    private readonly vehicleDepartmentRepository: VehicleDepartmentRepository,
  ) {}

  /**
   * Desativa o vínculo ativo do veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do veículo.
   * @throws {NotFoundException} Veículo não existe na empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: RemoveVehicleDepartmentInputDto,
  ): Promise<void> {
    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      input.vehicleId,
      actor.companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    await this.vehicleDepartmentRepository.deactivateByVehicleIdAndCompanyId(
      input.vehicleId,
      actor.companyId,
    );
  }
}
