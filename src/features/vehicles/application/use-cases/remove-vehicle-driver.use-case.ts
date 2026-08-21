// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repositories
import { USER_VEHICLE_REPOSITORY } from '../../domain/repositories/user-vehicle.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserVehicleRepository } from '../../domain/repositories/user-vehicle.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { RemoveDriverInputDto } from '../dto/remove-driver-input.dto';

/**
 * Remove o vínculo motorista ↔ veículo — **delete físico** (a tabela
 * `user_vehicle` não tem `is_active`; ADR 0006 §2).
 */
@Injectable()
export class RemoveVehicleDriverUseCase {
  private readonly logger = new Logger(RemoveVehicleDriverUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(USER_VEHICLE_REPOSITORY)
    private readonly userVehicleRepository: UserVehicleRepository,
  ) {}

  /**
   * Remove o vínculo do motorista com o veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Ids do veículo e do motorista.
   * @throws {NotFoundException} Veículo não existe ou motorista não vinculado.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: RemoveDriverInputDto,
  ): Promise<void> {
    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      input.vehicleId,
      actor.companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    const link =
      await this.userVehicleRepository.findByUserIdAndVehicleIdAndCompanyId(
        input.userId,
        input.vehicleId,
        actor.companyId,
      );
    if (!link) {
      throw new NotFoundException('Motorista não vinculado a este veículo.');
    }

    await this.userVehicleRepository.removeByIdAndCompanyId(
      link.id,
      actor.companyId,
    );
  }
}
