// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repositories
import { USER_VEHICLE_REPOSITORY } from '../../domain/repositories/user-vehicle.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Mapper
import { toUserVehicleDriverResponse } from '../utils/user-vehicle-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserVehicleRepository } from '../../domain/repositories/user-vehicle.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { ListVehicleDriversInputDto } from '../dto/list-vehicle-drivers-input.dto';
import type { ListVehicleDriversResponse } from '../dto/user-vehicle-response';

/**
 * Lista os motoristas de um veículo na empresa da sessão (com `isPrimary`,
 * `canDrive` e o nome do motorista).
 */
@Injectable()
export class ListVehicleDriversUseCase {
  private readonly logger = new Logger(ListVehicleDriversUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(USER_VEHICLE_REPOSITORY)
    private readonly userVehicleRepository: UserVehicleRepository,
  ) {}

  /**
   * Lista os vínculos do veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do veículo.
   * @returns Vínculos (primários primeiro).
   * @throws {NotFoundException} Veículo não existe na empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListVehicleDriversInputDto,
  ): Promise<ListVehicleDriversResponse> {
    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      input.vehicleId,
      actor.companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    const drivers =
      await this.userVehicleRepository.findByVehicleIdAndCompanyId(
        input.vehicleId,
        actor.companyId,
      );

    return {
      vehicleId: input.vehicleId,
      drivers: drivers.map(toUserVehicleDriverResponse),
    };
  }
}
