// NestJS
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Repositories
import { USER_VEHICLE_REPOSITORY } from '../../domain/repositories/user-vehicle.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Mapper
import { toUserVehicleDriverResponse } from '../utils/user-vehicle-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserVehicleRepository } from '../../domain/repositories/user-vehicle.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { UpdateDriverInputDto } from '../dto/update-driver-input.dto';
import type { UserVehicleDriverResponse } from '../dto/user-vehicle-response';

/**
 * Ajusta o vínculo motorista ↔ veículo (`isPrimary`/`canDrive`) **sem
 * remover+recriar** (ADR 0006 §9). `is_primary = true` desmarca o primário
 * anterior do veículo (transação no repositório).
 */
@Injectable()
export class UpdateVehicleDriverUseCase {
  private readonly logger = new Logger(UpdateVehicleDriverUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(USER_VEHICLE_REPOSITORY)
    private readonly userVehicleRepository: UserVehicleRepository,
  ) {}

  /**
   * Atualiza o vínculo do motorista com o veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Ids e campos a atualizar.
   * @returns Vínculo atualizado (com o motorista).
   * @throws {NotFoundException} Veículo não existe ou motorista não vinculado.
   * @throws {ConflictException} Concorrência no unique parcial de primário.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: UpdateDriverInputDto,
  ): Promise<UserVehicleDriverResponse> {
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

    try {
      const updated = await this.userVehicleRepository.updateByIdAndCompanyId(
        link.id,
        actor.companyId,
        {
          isPrimary: input.isPrimary,
          canDrive: input.canDrive,
        },
      );
      if (!updated) {
        throw new NotFoundException('Vínculo não encontrado.');
      }
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException(
          'Já existe um proprietário primário para este veículo.',
        );
      }
      throw error;
    }

    const refreshed =
      await this.userVehicleRepository.findByUserIdAndVehicleIdAndCompanyId(
        input.userId,
        input.vehicleId,
        actor.companyId,
      );
    if (!refreshed) {
      throw new NotFoundException('Vínculo não encontrado.');
    }
    return toUserVehicleDriverResponse(refreshed);
  }
}
